"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BonanQuickCreatePageForm from "@/app/components/BonanQuickCreatePageForm";

export default function NewIncidentReportPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      try {
        const res = await fetch("/api/auth/session");
        const data = await res.json();

        if (!data.user) {
          router.push("/login");
          return;
        }

        if (data.user.role !== "admin") {
          router.push("/dashboard");
          return;
        }
      } catch (error) {
        console.error("Failed to initialize incident report creation page:", error);
        router.push("/login");
        return;
      } finally {
        setLoading(false);
      }
    }

    void init();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-(--bg)">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-(--text)"></div>
      </div>
    );
  }

  return <BonanQuickCreatePageForm mode="incident-report" />;
}
