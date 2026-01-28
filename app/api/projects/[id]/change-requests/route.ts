import { getSession, getUserById } from "@/lib/auth";
import { turso } from "@/lib/turso";
import { sendChangeRequestNotification, sendChangeRequestApprovalNotification } from "@/lib/email";
import { cookies } from "next/headers";

// Get change requests for a project
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get("session_id")?.value;

    if (!sessionId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await getSession(sessionId);
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserById(session.user_id);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Clients can only see their own requests
    // Admins can see all requests for the project
    let result;
    if (user.role === "client") {
      result = await turso.execute({
        sql: `SELECT cr.*,
              u.first_name || ' ' || u.last_name as requester_name,
              u.email as requester_email,
              r.first_name || ' ' || r.last_name as reviewer_name
              FROM project_change_requests cr
              LEFT JOIN users u ON cr.requested_by = u.id
              LEFT JOIN users r ON cr.reviewed_by = r.id
              WHERE cr.project_id = ? AND cr.requested_by = ?
              ORDER BY cr.created_at DESC`,
        args: [id, user.id],
      });
    } else {
      result = await turso.execute({
        sql: `SELECT cr.*,
              u.first_name || ' ' || u.last_name as requester_name,
              u.email as requester_email,
              r.first_name || ' ' || r.last_name as reviewer_name
              FROM project_change_requests cr
              LEFT JOIN users u ON cr.requested_by = u.id
              LEFT JOIN users r ON cr.reviewed_by = r.id
              WHERE cr.project_id = ?
              ORDER BY cr.created_at DESC`,
        args: [id],
      });
    }

    const changeRequests = result.rows.map((row) => ({
      id: row.id,
      project_id: row.project_id,
      requested_by: row.requested_by,
      requester_name: row.requester_name,
      requester_email: row.requester_email,
      status: row.status,
      message: row.message,
      requested_sections: row.requested_sections ? JSON.parse(row.requested_sections as string) : [],
      approved_sections: row.approved_sections ? JSON.parse(row.approved_sections as string) : [],
      admin_notes: row.admin_notes,
      reviewed_by: row.reviewed_by,
      reviewer_name: row.reviewer_name,
      reviewed_at: row.reviewed_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    return Response.json({ changeRequests });
  } catch (error) {
    console.error("Error fetching change requests:", error);
    return Response.json({ error: "Failed to fetch change requests" }, { status: 500 });
  }
}

// Create a new change request (clients only)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get("session_id")?.value;

    if (!sessionId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await getSession(sessionId);
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserById(session.user_id);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only clients can create change requests
    if (user.role !== "client") {
      return Response.json({ error: "Only clients can request changes" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { sections, message } = body;

    if (!sections || !Array.isArray(sections) || sections.length === 0) {
      return Response.json({ error: "At least one section must be selected" }, { status: 400 });
    }

    // Get project name for notifications
    const projectResult = await turso.execute({
      sql: "SELECT name FROM projects WHERE id = ?",
      args: [id],
    });

    if (projectResult.rows.length === 0) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }

    const projectName = projectResult.rows[0].name as string;

    // Create the change request
    const result = await turso.execute({
      sql: `INSERT INTO project_change_requests (project_id, requested_by, requested_sections, message)
            VALUES (?, ?, ?, ?)
            RETURNING *`,
      args: [id, user.id, JSON.stringify(sections), message || null],
    });

    const changeRequest = result.rows[0];

    // Send notification to admins
    sendChangeRequestNotification({
      projectId: id,
      projectName,
      requesterName: `${user.first_name} ${user.last_name}`,
      requesterEmail: user.email,
      sections,
      message: message || undefined,
    }).catch(console.error);

    return Response.json({
      changeRequest: {
        id: changeRequest.id,
        project_id: changeRequest.project_id,
        requested_by: changeRequest.requested_by,
        status: changeRequest.status,
        message: changeRequest.message,
        requested_sections: sections,
        created_at: changeRequest.created_at,
      },
    });
  } catch (error) {
    console.error("Error creating change request:", error);
    return Response.json({ error: "Failed to create change request" }, { status: 500 });
  }
}

// Review a change request (admin only)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get("session_id")?.value;

    if (!sessionId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await getSession(sessionId);
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserById(session.user_id);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can review change requests
    if (user.role !== "admin") {
      return Response.json({ error: "Only admins can review change requests" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { changeRequestId, action, approvedSections, adminNotes } = body;

    if (!changeRequestId) {
      return Response.json({ error: "Change request ID is required" }, { status: 400 });
    }

    if (!action || !["approve", "reject"].includes(action)) {
      return Response.json({ error: "Valid action (approve/reject) is required" }, { status: 400 });
    }

    // Get the change request
    const requestResult = await turso.execute({
      sql: `SELECT cr.*, p.name as project_name, u.email as requester_email, u.first_name || ' ' || u.last_name as requester_name
            FROM project_change_requests cr
            JOIN projects p ON cr.project_id = p.id
            JOIN users u ON cr.requested_by = u.id
            WHERE cr.id = ? AND cr.project_id = ?`,
      args: [changeRequestId, id],
    });

    if (requestResult.rows.length === 0) {
      return Response.json({ error: "Change request not found" }, { status: 404 });
    }

    const changeRequest = requestResult.rows[0];
    const newStatus = action === "approve" ? "approved" : "rejected";

    // Update the change request
    await turso.execute({
      sql: `UPDATE project_change_requests
            SET status = ?, approved_sections = ?, admin_notes = ?, reviewed_by = ?, reviewed_at = datetime('now'), updated_at = datetime('now')
            WHERE id = ?`,
      args: [
        newStatus,
        action === "approve" && approvedSections ? JSON.stringify(approvedSections) : null,
        adminNotes || null,
        user.id,
        changeRequestId,
      ],
    });

    // Send notification to requester
    sendChangeRequestApprovalNotification({
      projectId: id,
      projectName: changeRequest.project_name as string,
      requesterEmail: changeRequest.requester_email as string,
      requesterName: changeRequest.requester_name as string,
      status: newStatus,
      approvedSections: action === "approve" ? (approvedSections || []) : [],
      adminNotes: adminNotes || undefined,
      reviewerName: `${user.first_name} ${user.last_name}`,
    }).catch(console.error);

    return Response.json({ success: true, status: newStatus });
  } catch (error) {
    console.error("Error reviewing change request:", error);
    return Response.json({ error: "Failed to review change request" }, { status: 500 });
  }
}
