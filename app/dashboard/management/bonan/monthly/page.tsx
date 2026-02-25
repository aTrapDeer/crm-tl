"use client";

import BonanPeriodReportList from "../components/BonanPeriodReportList";

export default function BonanMonthlyReportsPage() {
  return (
    <BonanPeriodReportList
      reportType="monthly"
      title="Bonan Towers Operations - Monthly Work Orders Conversion"
      subtitle="Monthly Bonan Towers Operations collective summaries and closeout oversight"
      createLabel="+ New Monthly"
    />
  );
}
