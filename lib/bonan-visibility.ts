type BonanPublicationStatus = "draft" | "published";
type BonanWorkOrderStatus = "pending" | "in_progress" | "completed" | "cancelled";
type BonanIncidentStatus = "open" | "in_progress" | "closed";

export function isBonanClientVisibleWorkOrder(workOrder: {
  site: "bonan_towers" | null;
  publication_status: BonanPublicationStatus;
  work_completed: BonanWorkOrderStatus;
}) {
  return (
    workOrder.site === "bonan_towers" &&
    (
      workOrder.publication_status === "published" ||
      (workOrder.publication_status === "draft" && workOrder.work_completed === "pending")
    )
  );
}

export function isBonanClientVisibleIncidentReport(incidentReport: {
  site: "bonan_towers" | null;
  publication_status: BonanPublicationStatus;
  status: BonanIncidentStatus;
}) {
  return (
    incidentReport.site === "bonan_towers" &&
    (
      incidentReport.publication_status === "published" ||
      (incidentReport.publication_status === "draft" && incidentReport.status === "open")
    )
  );
}
