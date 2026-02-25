"use client";

import BonanPeriodReportList from "../components/BonanPeriodReportList";

export default function BonanWeeklyReportsPage() {
  return (
    <BonanPeriodReportList
      reportType="weekly"
      title="Bonan Towers Operations - Weekly Work Orders Conversion"
      subtitle="Weekly Bonan Towers Operations systems, work orders, incidents, and checkup rollups"
      createLabel="+ New Weekly"
    />
  );
}
