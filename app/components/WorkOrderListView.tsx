"use client";

import { useState, useMemo } from "react";

interface WorkOrder {
  id: string;
  work_order_number: string;
  date: string;
  time_received: string | null;
  phone: string | null;
  email: string | null;
  company: string | null;
  department: string | null;
  location: string | null;
  unit: string | null;
  area: string | null;
  priority: "emergency" | "high" | "normal" | "low";
  service_type: "maintenance" | "repair" | "replace" | "inspection" | "preventive" | "cleaning" | "other";
  description: string;
  assigned_to: string | null;
  assigned_user_name?: string;
  work_completed: "pending" | "in_progress" | "completed" | "cancelled";
  project_name?: string;
  created_at: string;
}

interface WorkOrderListViewProps {
  workOrders: WorkOrder[];
  onSelectWorkOrder: (workOrder: WorkOrder) => void;
  onEditWorkOrder?: (workOrder: WorkOrder) => void;
  onDeleteWorkOrder?: (workOrder: WorkOrder) => void;
  loading?: boolean;
}

const PRIORITY_COLORS = {
  emergency: "bg-red-100 text-red-700 border-red-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  normal: "bg-blue-100 text-blue-700 border-blue-200",
  low: "bg-gray-100 text-gray-700 border-gray-200",
};

const STATUS_COLORS = {
  pending: "bg-yellow-100 text-yellow-700",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-gray-100 text-gray-700",
};

const SERVICE_TYPES = [
  { value: "maintenance", label: "Maintenance" },
  { value: "repair", label: "Repair" },
  { value: "replace", label: "Replace" },
  { value: "inspection", label: "Inspection" },
  { value: "preventive", label: "Preventive" },
  { value: "cleaning", label: "Cleaning" },
  { value: "other", label: "Other" },
];

export default function WorkOrderListView({
  workOrders,
  onSelectWorkOrder,
  onEditWorkOrder,
  onDeleteWorkOrder,
  loading = false,
}: WorkOrderListViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<"date" | "priority" | "status">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const filteredAndSortedWorkOrders = useMemo(() => {
    let result = [...workOrders];

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (wo) =>
          wo.work_order_number.toLowerCase().includes(term) ||
          wo.company?.toLowerCase().includes(term) ||
          wo.location?.toLowerCase().includes(term) ||
          wo.description.toLowerCase().includes(term) ||
          wo.assigned_user_name?.toLowerCase().includes(term)
      );
    }

    // Apply status filter
    if (statusFilter) {
      result = result.filter((wo) => wo.work_completed === statusFilter);
    }

    // Apply priority filter
    if (priorityFilter) {
      result = result.filter((wo) => wo.priority === priorityFilter);
    }

    // Apply service type filter
    if (serviceTypeFilter) {
      result = result.filter((wo) => wo.service_type === serviceTypeFilter);
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case "date":
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case "priority": {
          const priorityOrder = { emergency: 0, high: 1, normal: 2, low: 3 };
          comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
          break;
        }
        case "status": {
          const statusOrder = { pending: 0, in_progress: 1, completed: 2, cancelled: 3 };
          comparison = statusOrder[a.work_completed] - statusOrder[b.work_completed];
          break;
        }
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

    return result;
  }, [workOrders, searchTerm, statusFilter, priorityFilter, serviceTypeFilter, sortBy, sortOrder]);

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("");
    setPriorityFilter("");
    setServiceTypeFilter("");
  };

  const hasActiveFilters = searchTerm || statusFilter || priorityFilter || serviceTypeFilter;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-(--text)"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="space-y-3">
        {/* Search Bar */}
        <div className="relative">
          <svg
            className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-(--text)/40"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search work orders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-xl border border-(--border) bg-(--bg) text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
          />
        </div>

        {/* Filter Row */}
        <div className="flex flex-wrap gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-(--border) bg-(--bg) text-(--text) text-sm focus:outline-none focus:ring-2 focus:ring-(--ring)"
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-(--border) bg-(--bg) text-(--text) text-sm focus:outline-none focus:ring-2 focus:ring-(--ring)"
          >
            <option value="">All Priority</option>
            <option value="emergency">Emergency</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>

          <select
            value={serviceTypeFilter}
            onChange={(e) => setServiceTypeFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-(--border) bg-(--bg) text-(--text) text-sm focus:outline-none focus:ring-2 focus:ring-(--ring)"
          >
            <option value="">All Types</option>
            {SERVICE_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>

          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [newSortBy, newSortOrder] = e.target.value.split("-") as [typeof sortBy, typeof sortOrder];
              setSortBy(newSortBy);
              setSortOrder(newSortOrder);
            }}
            className="px-3 py-2 rounded-lg border border-(--border) bg-(--bg) text-(--text) text-sm focus:outline-none focus:ring-2 focus:ring-(--ring)"
          >
            <option value="date-desc">Newest First</option>
            <option value="date-asc">Oldest First</option>
            <option value="priority-asc">Priority (High to Low)</option>
            <option value="priority-desc">Priority (Low to High)</option>
            <option value="status-asc">Status</option>
          </select>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Results Count */}
      <p className="text-sm text-(--text)/60">
        {filteredAndSortedWorkOrders.length} work order{filteredAndSortedWorkOrders.length !== 1 ? "s" : ""}
        {hasActiveFilters && ` (filtered from ${workOrders.length})`}
      </p>

      {/* Work Orders List */}
      {filteredAndSortedWorkOrders.length === 0 ? (
        <div className="text-center py-12">
          <svg
            className="w-12 h-12 mx-auto text-(--text)/30 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <p className="text-(--text)/60">
            {hasActiveFilters ? "No work orders match your filters" : "No work orders yet"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAndSortedWorkOrders.map((workOrder) => (
            <button
              key={workOrder.id}
              onClick={() => onSelectWorkOrder(workOrder)}
              className="w-full tl-card p-4 text-left hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-(--text)">
                      {workOrder.work_order_number}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[workOrder.priority]}`}
                    >
                      {workOrder.priority.charAt(0).toUpperCase() + workOrder.priority.slice(1)}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[workOrder.work_completed]}`}
                    >
                      {workOrder.work_completed.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                    </span>
                  </div>
                  <p className="text-sm text-(--text)/70 mb-1">
                    {workOrder.company || "No company"}
                    {workOrder.location && ` • ${workOrder.location}`}
                  </p>
                  <p className="text-sm text-(--text)/60 line-clamp-2">
                    {workOrder.description}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-(--text)/50">
                    <span>{new Date(workOrder.date).toLocaleDateString()}</span>
                    <span>
                      {SERVICE_TYPES.find((t) => t.value === workOrder.service_type)?.label}
                    </span>
                    {workOrder.assigned_user_name && (
                      <span>Assigned: {workOrder.assigned_user_name}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {onEditWorkOrder && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditWorkOrder(workOrder);
                      }}
                      className="p-2 rounded-lg hover:bg-(--bg) text-(--text)/50 hover:text-(--text) transition"
                      title="Edit work order"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  )}
                  {onDeleteWorkOrder && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteWorkOrder(workOrder);
                      }}
                      className="p-2 rounded-lg hover:bg-red-50 text-(--text)/50 hover:text-red-600 transition"
                      title="Delete work order"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                  <svg
                    className="w-5 h-5 text-(--text)/30"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
