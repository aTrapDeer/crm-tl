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
