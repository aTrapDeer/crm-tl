# Turso → S3 Nightly Backup — Portable Setup Guide

Daily (midnight Central) backup of a Turso SQL database to a write-only S3 bucket from a
Next.js App Router site on Vercel. No extra infrastructure: just Vercel Cron, Turso's
HTTP `/dump` endpoint, and S3.

Reference implementation: `arapier-crm` (working as of 2026-07-15).

How it works:

```text
Vercel Cron (05:00 + 06:00 UTC, covers DST)
  → GET /api/cron/backup-db          (requires CRON_SECRET bearer token)
    → checks it is the midnight hour in America/Chicago, else skips
    → GET https://<db-host>/dump     (read-only HTTP call, no table locks)
    → gzip in memory
    → PutObject → s3://<bucket>/turso/YYYY/MM/DD/HHmmss-cron.sql.gz
```

Plus a manual "Back up now" button in the site's admin portal, restricted to one email.

---

## 1. One-time AWS setup (shared across all sites)

### 1.1 Buckets

One private bucket per site (Block Public Access ON, Versioning ON recommended):

- `backups-biat-crm-tursodb`
- `backups-biat-music-tursodb`
- `backups-tlcorp-crm-tursodb`

### 1.2 IAM user (write-only)

One IAM user shared by all three sites. Attach ONLY this policy — it can upload but can
never list, download, or delete, so a leaked key means write-only pollution at worst:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowWriteOnlyBackupUploads",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:AbortMultipartUpload"],
      "Resource": [
        "arn:aws:s3:::backups-biat-crm-tursodb/*",
        "arn:aws:s3:::backups-biat-music-tursodb/*",
        "arn:aws:s3:::backups-tlcorp-crm-tursodb/*"
      ]
    },
    {
      "Sid": "DenyReadListDelete",
      "Effect": "Deny",
      "Action": [
        "s3:GetObject",
        "s3:GetObjectVersion",
        "s3:DeleteObject",
        "s3:DeleteObjectVersion",
        "s3:ListBucket",
        "s3:ListBucketVersions",
        "s3:ListBucketMultipartUploads",
        "s3:RestoreObject"
      ],
      "Resource": [
        "arn:aws:s3:::backups-biat-crm-tursodb",
        "arn:aws:s3:::backups-biat-crm-tursodb/*",
        "arn:aws:s3:::backups-biat-music-tursodb",
        "arn:aws:s3:::backups-biat-music-tursodb/*",
        "arn:aws:s3:::backups-tlcorp-crm-tursodb",
        "arn:aws:s3:::backups-tlcorp-crm-tursodb/*"
      ]
    }
  ]
}
```

Restores/downloads happen with your separate admin identity, never this user.
Uploads use SSE-S3 (`AES256`) so no KMS permissions are needed.

---

## 2. Per-site environment variables

Add to `.env.local` AND to the Vercel project (Production):

```bash
# Existing — already present in any Turso site
TURSO_DATABASE_URL=libsql://<your-db>.turso.io
TURSO_AUTH_TOKEN=<app token>

# S3 backup of DB schema and entries
IAM_ACCESS_KEY=<backup IAM user access key>
IAM_SECRET_KEY=<backup IAM user secret key>
S3_BUCKET_DB=<this site's bucket, e.g. backups-biat-music-tursodb>
AWS_BACKUP_REGION=us-east-1

# Cron auth — generate per site, do not reuse across sites:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
CRON_SECRET=<random hex>

# Optional but recommended: dedicated read-only Turso token for backups.
# Create with: turso db tokens create <db-name> --read-only
# Code falls back to TURSO_AUTH_TOKEN when this is absent.
TURSO_BACKUP_AUTH_TOKEN=<read-only token>
```

Notes:
- `CRON_SECRET` is a Vercel convention: when that env var exists, Vercel Cron sends it
  as `Authorization: Bearer <value>` on cron invocations automatically.
- `TURSO_DATABASE_URL` must be a remote `libsql://` URL (backups refuse `file:` DBs).

Install the one new dependency:

```bash
npm install @aws-sdk/client-s3
```

`date-fns-tz` is also required (already present in most of our sites).

---

## 3. Files to copy

Copy these verbatim unless marked **ADAPT**. Paths assume App Router with `@/` alias.

### 3.1 `lib/backup/env.ts` — env validation (copy as-is)

```ts
export interface BackupEnv {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucket: string;
  /** HTTPS /dump endpoint derived from TURSO_DATABASE_URL. */
  dumpUrl: string;
  tursoToken: string;
}

/**
 * Reads and validates the S3 backup credentials and Turso connection info
 * from the environment. Throws a clear error naming the first missing
 * variable so misconfiguration is obvious.
 */
export function getBackupEnv(): BackupEnv {
  const accessKeyId = process.env.IAM_ACCESS_KEY;
  if (!accessKeyId) throw new Error("IAM_ACCESS_KEY is not set.");

  const secretAccessKey = process.env.IAM_SECRET_KEY;
  if (!secretAccessKey) throw new Error("IAM_SECRET_KEY is not set.");

  const region = process.env.AWS_BACKUP_REGION;
  if (!region) throw new Error("AWS_BACKUP_REGION is not set.");

  const bucket = process.env.S3_BUCKET_DB;
  if (!bucket) throw new Error("S3_BUCKET_DB is not set.");

  const databaseUrl = process.env.TURSO_DATABASE_URL;
  if (!databaseUrl) throw new Error("TURSO_DATABASE_URL is not set.");
  if (!databaseUrl.startsWith("libsql://")) {
    throw new Error("Backups require a remote Turso database (libsql:// URL).");
  }

  // Prefer a dedicated read-only token when provided; fall back to the app token.
  const tursoToken = process.env.TURSO_BACKUP_AUTH_TOKEN ?? process.env.TURSO_AUTH_TOKEN;
  if (!tursoToken) throw new Error("TURSO_AUTH_TOKEN is not set.");

  const dumpUrl = `${databaseUrl.replace(/^libsql:\/\//, "https://").replace(/\/+$/, "")}/dump`;

  return { accessKeyId, secretAccessKey, region, bucket, dumpUrl, tursoToken };
}
```

### 3.2 `lib/backup/schedule.ts` — schedule + access gate (**ADAPT** the email)

```ts
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export const BACKUP_TIMEZONE = "America/Chicago";

/** Only this account can see the backup panel and trigger manual backups. */
export const BACKUP_MANAGER_EMAIL = "andrewrapier@beatitat.com"; // ADAPT per site if needed

export function canManageBackups(email: string) {
  return email.trim().toLowerCase() === BACKUP_MANAGER_EMAIL;
}

/**
 * The Vercel crons fire at both 05:00 and 06:00 UTC so one of them always
 * lands in the midnight hour in Central time regardless of DST. This guard
 * lets the handler skip the run that lands at 11pm or 1am local.
 */
export function isMidnightHourCentral(now: Date = new Date()) {
  return formatInTimeZone(now, BACKUP_TIMEZONE, "H") === "0";
}

/** UTC instant of the next midnight in Central time. */
export function getNextScheduledBackup(now: Date = new Date()): Date {
  const todayCentral = formatInTimeZone(now, BACKUP_TIMEZONE, "yyyy-MM-dd");
  const [year, month, day] = todayCentral.split("-").map(Number);
  // Date.UTC normalizes day overflow (e.g. Jul 32 -> Aug 1), giving us
  // tomorrow's calendar date in Central; fromZonedTime pins it to midnight.
  const tomorrow = new Date(Date.UTC(year, month - 1, day + 1));
  const tomorrowCentral = formatInTimeZone(tomorrow, "UTC", "yyyy-MM-dd");
  return fromZonedTime(`${tomorrowCentral}T00:00:00`, BACKUP_TIMEZONE);
}

export function formatCentral(date: Date) {
  return formatInTimeZone(date, BACKUP_TIMEZONE, "EEE, MMM d 'at' h:mm a zzz");
}
```

### 3.3 `lib/backup/run-backup.ts` — dump → gzip → S3 (copy as-is)

```ts
import { gzipSync } from "node:zlib";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { formatInTimeZone } from "date-fns-tz";

import { getBackupEnv } from "@/lib/backup/env";
import { BACKUP_TIMEZONE } from "@/lib/backup/schedule";

export interface BackupResult {
  key: string;
  bucket: string;
  dumpBytes: number;
  uploadedBytes: number;
}

/**
 * Pulls a full SQL dump from Turso's /dump endpoint, gzips it, and uploads it
 * to S3. Read-only against the database; never touches application tables.
 */
export async function runDatabaseBackup(trigger: "cron" | "manual"): Promise<BackupResult> {
  const env = getBackupEnv();

  const response = await fetch(env.dumpUrl, {
    headers: { Authorization: `Bearer ${env.tursoToken}` },
    // Dump can be slow on larger databases; don't let Next cache it.
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Turso dump failed: ${response.status} ${response.statusText}`);
  }

  const dump = Buffer.from(await response.arrayBuffer());
  // An empty or implausibly small dump means something upstream broke; do not
  // upload garbage that could be mistaken for a good backup.
  if (dump.byteLength < 100 || !dump.toString("utf8", 0, 200).includes("TRANSACTION")) {
    throw new Error(`Turso dump looks invalid (${dump.byteLength} bytes).`);
  }

  const body = gzipSync(dump);
  const stamp = formatInTimeZone(new Date(), BACKUP_TIMEZONE, "yyyy/MM/dd/HHmmss");
  const key = `turso/${stamp}-${trigger}.sql.gz`;

  const s3 = new S3Client({
    region: env.region,
    credentials: {
      accessKeyId: env.accessKeyId,
      secretAccessKey: env.secretAccessKey,
    },
  });

  await s3.send(
    new PutObjectCommand({
      Bucket: env.bucket,
      Key: key,
      Body: body,
      ContentType: "application/gzip",
      ContentEncoding: "gzip",
      ServerSideEncryption: "AES256",
      Metadata: {
        trigger,
        "dump-bytes": String(dump.byteLength),
      },
    }),
  );

  return {
    key,
    bucket: env.bucket,
    dumpBytes: dump.byteLength,
    uploadedBytes: body.byteLength,
  };
}
```

### 3.4 `app/api/cron/backup-db/route.ts` — nightly cron route (copy as-is)

```ts
import { NextResponse } from "next/server";

import { runDatabaseBackup } from "@/lib/backup/run-backup";
import { isMidnightHourCentral } from "@/lib/backup/schedule";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // Two UTC crons (05:00 and 06:00) cover both DST offsets; only the one that
  // lands in the midnight hour Central actually backs up.
  if (!isMidnightHourCentral()) {
    return NextResponse.json({ ok: true, skipped: "Not midnight in America/Chicago." });
  }

  try {
    const result = await runDatabaseBackup("cron");
    console.log(`[backup-db] cron backup uploaded s3://${result.bucket}/${result.key}`);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[backup-db] cron backup failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Backup failed." },
      { status: 500 },
    );
  }
}
```

### 3.5 `app/api/admin/backup-db/route.ts` — manual trigger (**ADAPT** auth)

This is the one file tied to each site's auth system. Requirements:

1. Verify the request comes from a logged-in admin **of that site**.
2. Verify the admin's email passes `canManageBackups`.
3. Then run the backup.

`arapier-crm` version — swap `requireAdminApiUser` / error handling for the target
site's equivalents:

```ts
import { NextResponse } from "next/server";

import { ApiError, handleApiError } from "@/lib/api";            // ADAPT
import { requireAdminApiUser } from "@/lib/auth/guards";          // ADAPT
import { runDatabaseBackup } from "@/lib/backup/run-backup";
import { canManageBackups, getNextScheduledBackup } from "@/lib/backup/schedule";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  try {
    const user = await requireAdminApiUser();                     // ADAPT
    if (!canManageBackups(user.email)) {
      throw new ApiError(403, "Backup access is restricted.");    // ADAPT
    }

    const result = await runDatabaseBackup("manual");
    return NextResponse.json({
      ok: true,
      ...result,
      nextScheduledUtc: getNextScheduledBackup().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);                                 // ADAPT
  }
}
```

If a site has no session-based admin API guard, the minimum viable gate is: read the
site's session cookie, resolve the user, 401 if absent, 403 unless the email matches.
Never expose this route unauthenticated.

### 3.6 `components/admin-backup-panel.tsx` — admin UI (**ADAPT** styling/fetch)

Client component with the next-backup label and a manual trigger button. The
`requestJson` helper is a thin `fetch` wrapper that throws on non-2xx with the JSON
`error` message — replace with the site's own fetch helper or plain `fetch`.

```tsx
"use client";

import { useState } from "react";

import { requestJson } from "@/lib/http-client"; // ADAPT: any JSON fetch helper

interface BackupResponse {
  key: string;
  bucket: string;
  dumpBytes: number;
  uploadedBytes: number;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AdminBackupPanel({ nextBackupLabel }: { nextBackupLabel: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onBackupNow() {
    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await requestJson<BackupResponse>("/api/admin/backup-db", {
        method: "POST",
      });
      setSuccess(
        `Backup uploaded to ${result.bucket} (${formatBytes(result.uploadedBytes)} compressed).`,
      );
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Backup failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Database backups</h2>
          <p className="mt-1 text-sm text-slate-500">
            The Turso database is dumped and saved to S3 every night at midnight Central.
          </p>
          <p className="mt-3 text-sm text-slate-700">
            <span className="font-medium">Next automatic backup:</span> {nextBackupLabel}
          </p>
        </div>
        <button
          type="button"
          onClick={onBackupNow}
          disabled={pending}
          className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50 transition"
        >
          {pending ? "Backing up..." : "Back up now"}
        </button>
      </div>
      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
      {success ? <p className="mt-3 text-sm text-emerald-700">{success}</p> : null}
    </section>
  );
}
```

### 3.7 Mount the panel in the site's admin page (**ADAPT**)

In whatever server component renders that site's admin/team/settings portal:

```tsx
import { AdminBackupPanel } from "@/components/admin-backup-panel";
import { canManageBackups, formatCentral, getNextScheduledBackup } from "@/lib/backup/schedule";

// ...inside the page, after resolving the logged-in user:
{canManageBackups(user.email) ? (
  <AdminBackupPanel nextBackupLabel={formatCentral(getNextScheduledBackup())} />
) : null}
```

The page-level check only hides the UI; the real enforcement is in the API route (3.5).

### 3.8 `vercel.json` — cron schedules (copy as-is; merge if the file exists)

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    {
      "path": "/api/cron/backup-db",
      "schedule": "0 5 * * *"
    },
    {
      "path": "/api/cron/backup-db",
      "schedule": "0 6 * * *"
    }
  ]
}
```

Why two: Vercel Cron is UTC-only with no timezone support. Midnight Central is 05:00
UTC during CDT and 06:00 UTC during CST. Both fire year-round; the handler's
`isMidnightHourCentral()` check makes exactly one of them do the actual backup, so DST
never requires a redeploy. (Hobby-plan note: daily crons may fire anywhere within the
scheduled hour — that is fine here.)

### 3.9 `scripts/test-backup.ts` — local verification (**ADAPT** env loading)

```ts
import { loadEnvFile } from "@/lib/load-env-file"; // ADAPT: or use dotenv, or tsx --env-file
import { runDatabaseBackup } from "@/lib/backup/run-backup";
import {
  formatCentral,
  getNextScheduledBackup,
  isMidnightHourCentral,
} from "@/lib/backup/schedule";

loadEnvFile();

async function main() {
  console.log("Next scheduled backup:", formatCentral(getNextScheduledBackup()));
  console.log("Is midnight hour Central right now:", isMidnightHourCentral());

  const result = await runDatabaseBackup("manual");
  console.log("Uploaded:", `s3://${result.bucket}/${result.key}`);
  console.log("Dump size:", result.dumpBytes, "bytes; compressed:", result.uploadedBytes, "bytes");
}

main().catch((error) => {
  console.error("Backup test failed:", error);
  process.exit(1);
});
```

If the site has no `loadEnvFile` helper, run with `npx tsx --env-file=.env.local scripts/test-backup.ts`
and drop the import instead.

---

## 4. Per-site rollout checklist

1. [ ] Bucket exists for this site; IAM policy includes its ARNs (section 1).
2. [ ] `npm install @aws-sdk/client-s3` (and `date-fns-tz` if missing).
3. [ ] Copy `lib/backup/` (3 files); set the manager email in `schedule.ts`.
4. [ ] Copy cron route as-is; write the manual route against this site's auth.
5. [ ] Copy the panel component; mount it in this site's admin portal.
6. [ ] Add/merge `vercel.json` crons.
7. [ ] Fill `.env.local` (section 2); generate a fresh `CRON_SECRET`.
8. [ ] `npx tsx scripts/test-backup.ts` → confirm the object appears in S3.
9. [ ] `npm run lint` and `npx tsc --noEmit` pass.
10. [ ] Add the same env vars to the Vercel project (Production) and deploy.
11. [ ] Next morning: confirm a `-cron.sql.gz` object exists for last midnight.
12. [ ] Once per site: restore drill (below).

## 5. Restore drill (do once per site, with admin AWS credentials)

```bash
# Download with your ADMIN identity (the backup IAM user cannot read - by design)
aws s3 cp s3://<bucket>/turso/<yyyy>/<mm>/<dd>/<file>.sql.gz .

# Decompress (PowerShell has no gunzip; use tar on Win10+ or 7-Zip)
tar -xzf <file>.sql.gz   # or: python -c "import gzip,shutil;shutil.copyfileobj(gzip.open('<file>.sql.gz','rb'),open('dump.sql','wb'))"

# Load into a throwaway DB and eyeball the tables
turso db create restore-test
turso db shell restore-test < dump.sql
turso db shell restore-test "SELECT name FROM sqlite_master WHERE type='table'"
turso db destroy restore-test --yes
```

A backup you have never restored is a hope, not a backup.

## 6. Design decisions (why it is built this way)

- **`/dump` over table-by-table SELECT**: one read-only HTTP call, no app query path,
  no locks, restorable with plain `sqlite3`/`turso db shell`.
- **Write-only IAM + versioning**: a compromised Vercel env cannot read or destroy
  history; overwrites are recoverable via object versions.
- **Sanity check before upload**: a tiny or non-SQL dump throws instead of silently
  replacing good backups with garbage.
- **Backup failures are isolated**: the cron route logs and returns 500; nothing else
  in the site shares code paths with it, so user traffic is unaffected.
- **Per-site `CRON_SECRET`**: leaking one site's secret does not open the others.
- **Keys are date-sharded** (`turso/YYYY/MM/DD/HHmmss-<trigger>.sql.gz`): easy lifecycle
  rules later (e.g. expire objects after N days via S3 lifecycle — configured on the
  bucket by an admin, not by this IAM user).
