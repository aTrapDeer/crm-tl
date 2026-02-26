"use client";

import BonanPeriodReportList from "../components/BonanPeriodReportList";

export default function BonanMonthlyReportsPage() {
  return (
    <BonanPeriodReportList
      reportType="monthly"
      title="Bonan Towers Operations - Monthly Checklist"
      subtitle="Checklist work-order execution logs for monthly inspections, deficiencies, elevators, and closeout prep"
      createLabel="+ New Monthly Checklist"
      detailPathBase="/dashboard/bonan/monthly"
      allowedRoles={["admin", "employee"]}
      disallowedRedirectPath="/dashboard/bonan/monthly-summaries"
      contextLinks={[
        { href: "/dashboard/bonan/monthly-summaries", label: "Open Monthly Summary View" },
        { href: "/dashboard/bonan/weekly", label: "Weekly Rollups" },
        { href: "/dashboard/bonan/daily", label: "Daily Walkthroughs" },
      ]}
    />
  );
}
