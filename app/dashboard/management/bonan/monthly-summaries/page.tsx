"use client";

import BonanPeriodReportList from "../components/BonanPeriodReportList";

export default function BonanMonthlySummariesPage() {
  return (
    <BonanPeriodReportList
      reportType="monthly"
      title="Bonan Towers Operations - Monthly Summaries"
      subtitle="Month-wide connected review for work orders, incidents, weekly rollups, and daily walkthrough chain"
      createLabel="+ New Monthly Summary"
      detailPathBase="/dashboard/bonan/monthly-summaries"
      showCreate={false}
      allowedRoles={["admin", "client"]}
      disallowedRedirectPath="/dashboard/bonan/monthly"
      contextLinks={[
        { href: "/dashboard/bonan/monthly", label: "Monthly Checklists" },
        { href: "/dashboard/bonan/weekly", label: "Weekly Checks" },
        { href: "/dashboard/bonan/daily", label: "Daily Logs" },
      ]}
    />
  );
}
