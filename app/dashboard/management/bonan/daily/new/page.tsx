"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function NewBonanDailyReportPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    async function createReport() {
      try {
        const sessionRes = await fetch("/api/auth/session");
        const sessionData = await sessionRes.json();

        if (!sessionData.user) {
          router.push("/login");
          return;
        }
        if (sessionData.user.role === "client") {
          router.push("/dashboard");
          return;
        }

        const res = await fetch("/api/bonan/reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ report_type: "daily" }),
        });
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Failed to create Bonan daily report.");
          return;
        }

        router.replace(`/dashboard/bonan/daily/${data.report.id}`);
      } catch (createError) {
        console.error("Failed to create Bonan daily report:", createError);
        setError("Failed to create Bonan daily report.");
      }
    }

    createReport();
  }, [router]);

  return (
    <div className="min-h-screen bg-(--bg) flex items-center justify-center p-4">
      <div className="tl-card max-w-md w-full p-6 text-center space-y-3">
        {!error ? (
          <>
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-(--text)"></div>
            <p className="text-sm text-(--text)/70">Creating Bonan daily walk-through...</p>
          </>
        ) : (
          <>
            <p className="text-sm text-red-700">{error}</p>
            <div className="flex items-center justify-center gap-2">
              <Link
                href="/dashboard/bonan/daily"
                className="rounded-full border border-(--border)/30 px-4 py-2 text-sm font-medium text-(--text) hover:bg-(--bg) transition"
              >
                Daily Reports
              </Link>
              <Link
                href="/dashboard/bonan"
                className="rounded-full border border-(--border)/30 px-4 py-2 text-sm font-medium text-(--text) hover:bg-(--bg) transition"
              >
                Bonan Dashboard
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
