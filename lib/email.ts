// Email service using Gmail SMTP with nodemailer
import nodemailer from "nodemailer";
import { turso } from "./turso";

const GMAIL_LOGIN = process.env.GMAIL_LOGIN;
const GMAIL_PASSWORD = process.env.GMAIL_PW;
// Use GMAIL_FROM for the "From" address display, authenticate with GMAIL_LOGIN
const GMAIL_FROM = process.env.GMAIL_FROM || process.env.GMAIL_LOGIN || "no-reply@taylorleonard.com";
const GMAIL_FROM_NAME = process.env.GMAIL_FROM_NAME || "Taylor Leonard CRM";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// Create reusable transporter
const transporter = GMAIL_LOGIN && GMAIL_PASSWORD
  ? nodemailer.createTransport({
      host: process.env.GMAIL_SMTP || "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: GMAIL_LOGIN,
        pass: GMAIL_PASSWORD,
      },
    })
  : null;

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
}

async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  const recipients = Array.isArray(options.to) ? options.to : [options.to];

  if (!transporter) {
    console.log("📧 Email would be sent (Gmail not configured):");
    console.log(`   To: ${recipients.join(", ")}`);
    console.log(`   Subject: ${options.subject}`);
    console.log("   ---");
    return true;
  }

  try {
    await transporter.sendMail({
      from: `"${GMAIL_FROM_NAME}" <${GMAIL_FROM}>`,
      to: recipients.join(", "),
      subject: options.subject,
      html: options.html,
    });
    console.log(`📧 Email sent to: ${recipients.join(", ")}`);
    return true;
  } catch (error) {
    console.error("Failed to send email:", error);
    return false;
  }
}

// Get base email template
function getEmailTemplate(content: string, title: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f7f8fb;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="min-width: 100%; background-color: #f7f8fb;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 24px rgba(1, 34, 79, 0.08);">
              <!-- Header -->
              <tr>
                <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #01224f 0%, #043271 100%); border-radius: 16px 16px 0 0;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">
                    Taylor Leonard CRM
                  </h1>
                </td>
              </tr>
              <!-- Content -->
              <tr>
                <td style="padding: 40px;">
                  ${content}
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="padding: 24px 40px; border-top: 1px solid #e8edf4; text-align: center;">
                  <p style="margin: 0; color: #7ba8b3; font-size: 12px;">
                    &copy; ${new Date().getFullYear()} Taylor Leonard CRM. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

// ============ HELPER FUNCTIONS ============

async function getAdminEmails(): Promise<string[]> {
  const result = await turso.execute(
    "SELECT email FROM users WHERE role = 'admin'"
  );
  return result.rows.map((row) => row.email as string);
}

async function getProjectAssociatedEmails(projectId: string): Promise<string[]> {
  const result = await turso.execute({
    sql: `SELECT DISTINCT u.email
          FROM users u
          INNER JOIN project_assignments pa ON u.id = pa.user_id
          WHERE pa.project_id = ?`,
    args: [projectId],
  });
  return result.rows.map((row) => row.email as string);
}

async function getWorkOrderAssociatedEmails(workOrderId: string): Promise<string[]> {
  const result = await turso.execute({
    sql: `SELECT DISTINCT u.email
          FROM users u
          LEFT JOIN work_orders wo ON (u.id = wo.assigned_to OR u.id = wo.created_by)
          WHERE wo.id = ? AND u.email IS NOT NULL`,
    args: [workOrderId],
  });

  // Also get all admins
  const admins = await getAdminEmails();
  const emails = result.rows.map((row) => row.email as string);

  return [...new Set([...emails, ...admins])];
}

// ============ PROJECT INVITATION EMAIL ============

export async function sendInvitationEmail(data: {
  to: string;
  projectName: string;
  inviterName: string;
  inviteToken: string;
}): Promise<boolean> {
  const signupUrl = `${APP_URL}/register?invite=${data.inviteToken}`;

  const content = `
    <h2 style="margin: 0 0 16px; color: #01224f; font-size: 20px; font-weight: 600;">
      You've been invited to join a project!
    </h2>
    <p style="margin: 0 0 24px; color: #0d3e8d; font-size: 16px; line-height: 1.6;">
      <strong>${data.inviterName}</strong> has invited you to collaborate on the project:
    </p>
    <div style="background-color: #f7f8fb; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <p style="margin: 0; color: #01224f; font-size: 18px; font-weight: 600;">
        ${data.projectName}
      </p>
    </div>
    <p style="margin: 0 0 24px; color: #0d3e8d; font-size: 16px; line-height: 1.6;">
      Click the button below to create your account and get access to this project.
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td align="center">
          <a href="${signupUrl}" style="display: inline-block; padding: 16px 32px; background-color: #01224f; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 12px;">
            Accept Invitation & Sign Up
          </a>
        </td>
      </tr>
    </table>
    <p style="margin: 32px 0 0; color: #7ba8b3; font-size: 14px; line-height: 1.6;">
      This invitation will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
    </p>
  `;

  return sendEmail({
    to: data.to,
    subject: `You've been invited to join "${data.projectName}"`,
    html: getEmailTemplate(content, "Project Invitation"),
  });
}

// ============ MANAGEMENT INVITATION EMAIL ============

export async function sendManagementInvitationEmail(data: {
  to: string;
  inviterName: string;
  inviteToken: string;
  entityType: "management" | "project";
  entityName: string;
}): Promise<boolean> {
  const signupUrl = `${APP_URL}/register?invite=${data.inviteToken}&type=${data.entityType}`;

  const content = `
    <h2 style="margin: 0 0 16px; color: #01224f; font-size: 20px; font-weight: 600;">
      You've been invited as a customer!
    </h2>
    <p style="margin: 0 0 24px; color: #0d3e8d; font-size: 16px; line-height: 1.6;">
      <strong>${data.inviterName}</strong> has invited you to view ${data.entityType === "management" ? "management contracts" : "the project"}:
    </p>
    <div style="background-color: #f7f8fb; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <p style="margin: 0; color: #01224f; font-size: 18px; font-weight: 600;">
        ${data.entityName}
      </p>
    </div>
    <p style="margin: 0 0 24px; color: #0d3e8d; font-size: 16px; line-height: 1.6;">
      As a customer, you'll be able to view updates and documents related to this ${data.entityType}.
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td align="center">
          <a href="${signupUrl}" style="display: inline-block; padding: 16px 32px; background-color: #01224f; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 12px;">
            Accept Invitation & Sign Up
          </a>
        </td>
      </tr>
    </table>
    <p style="margin: 32px 0 0; color: #7ba8b3; font-size: 14px; line-height: 1.6;">
      This invitation will expire in 7 days.
    </p>
  `;

  return sendEmail({
    to: data.to,
    subject: `You've been invited to view "${data.entityName}"`,
    html: getEmailTemplate(content, "Customer Invitation"),
  });
}

// ============ TASK CHANGE NOTIFICATION EMAIL ============

export async function sendTaskChangeNotification(data: {
  projectId: string;
  projectName: string;
  taskTitle: string;
  action: "created" | "completed" | "updated" | "deleted";
  performedBy: string;
}): Promise<boolean> {
  const adminEmails = await getAdminEmails();
  if (adminEmails.length === 0) return true;

  const actionColors: Record<string, string> = {
    created: "#2563eb",
    completed: "#16a34a",
    updated: "#d97706",
    deleted: "#dc2626",
  };

  const actionLabels: Record<string, string> = {
    created: "New Task Created",
    completed: "Task Completed",
    updated: "Task Updated",
    deleted: "Task Deleted",
  };

  const projectUrl = `${APP_URL}/dashboard/projects/${data.projectId}`;

  const content = `
    <div style="background-color: ${actionColors[data.action]}15; border-left: 4px solid ${actionColors[data.action]}; padding: 16px; border-radius: 0 12px 12px 0; margin-bottom: 24px;">
      <p style="margin: 0; color: ${actionColors[data.action]}; font-size: 14px; font-weight: 600; text-transform: uppercase;">
        ${actionLabels[data.action]}
      </p>
    </div>
    <h2 style="margin: 0 0 16px; color: #01224f; font-size: 20px; font-weight: 600;">
      Project Task Update
    </h2>
    <p style="margin: 0 0 16px; color: #0d3e8d; font-size: 16px; line-height: 1.6;">
      A task has been ${data.action} in the project <strong>${data.projectName}</strong>.
    </p>
    <div style="background-color: #f7f8fb; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <p style="margin: 0 0 8px; color: #6b7280; font-size: 12px; text-transform: uppercase;">Task</p>
      <p style="margin: 0; color: #01224f; font-size: 16px; font-weight: 600;">
        ${data.taskTitle}
      </p>
    </div>
    <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px;">
      Action performed by: <strong>${data.performedBy}</strong>
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td align="center">
          <a href="${projectUrl}" style="display: inline-block; padding: 14px 28px; background-color: #01224f; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; border-radius: 12px;">
            View Project
          </a>
        </td>
      </tr>
    </table>
  `;

  return sendEmail({
    to: adminEmails,
    subject: `[${actionLabels[data.action]}] ${data.taskTitle} - ${data.projectName}`,
    html: getEmailTemplate(content, "Task Notification"),
  });
}

// ============ WORK ORDER CHANGE NOTIFICATION EMAIL ============

export async function sendWorkOrderChangeNotification(data: {
  workOrderId: string;
  workOrderNumber: string;
  action: "created" | "completed" | "updated" | "status_changed";
  newStatus?: string;
  description: string;
  performedBy: string;
  company?: string;
  location?: string;
}): Promise<boolean> {
  const adminEmails = await getAdminEmails();
  if (adminEmails.length === 0) return true;

  const actionColors: Record<string, string> = {
    created: "#2563eb",
    completed: "#16a34a",
    updated: "#d97706",
    status_changed: "#8b5cf6",
  };

  const actionLabels: Record<string, string> = {
    created: "New Work Order",
    completed: "Work Order Completed",
    updated: "Work Order Updated",
    status_changed: "Status Changed",
  };

  const workOrderUrl = `${APP_URL}/dashboard/management/work-orders/${data.workOrderId}`;

  const content = `
    <div style="background-color: ${actionColors[data.action]}15; border-left: 4px solid ${actionColors[data.action]}; padding: 16px; border-radius: 0 12px 12px 0; margin-bottom: 24px;">
      <p style="margin: 0; color: ${actionColors[data.action]}; font-size: 14px; font-weight: 600; text-transform: uppercase;">
        ${actionLabels[data.action]}${data.newStatus ? `: ${data.newStatus.replace("_", " ").toUpperCase()}` : ""}
      </p>
    </div>
    <h2 style="margin: 0 0 16px; color: #01224f; font-size: 20px; font-weight: 600;">
      Work Order #${data.workOrderNumber}
    </h2>
    ${data.company || data.location ? `
    <p style="margin: 0 0 16px; color: #6b7280; font-size: 14px;">
      ${data.company ? `<strong>${data.company}</strong>` : ""}${data.company && data.location ? " - " : ""}${data.location || ""}
    </p>
    ` : ""}
    <div style="background-color: #f7f8fb; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <p style="margin: 0 0 8px; color: #6b7280; font-size: 12px; text-transform: uppercase;">Description</p>
      <p style="margin: 0; color: #01224f; font-size: 14px; line-height: 1.5;">
        ${data.description.substring(0, 200)}${data.description.length > 200 ? "..." : ""}
      </p>
    </div>
    <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px;">
      Action performed by: <strong>${data.performedBy}</strong>
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td align="center">
          <a href="${workOrderUrl}" style="display: inline-block; padding: 14px 28px; background-color: #01224f; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; border-radius: 12px;">
            View Work Order
          </a>
        </td>
      </tr>
    </table>
  `;

  return sendEmail({
    to: adminEmails,
    subject: `[${actionLabels[data.action]}] WO #${data.workOrderNumber}${data.company ? ` - ${data.company}` : ""}`,
    html: getEmailTemplate(content, "Work Order Notification"),
  });
}

// ============ SIGNATURE ALERT EMAIL ============

export async function sendSignatureAlertEmail(data: {
  workOrderId: string;
  workOrderNumber: string;
  signerType: "tl_corp_rep" | "building_rep";
  signerName: string;
  signerTitle?: string;
  company?: string;
  location?: string;
}): Promise<boolean> {
  // Get all associated emails (admins + assigned users + creator)
  const emails = await getWorkOrderAssociatedEmails(data.workOrderId);
  if (emails.length === 0) return true;

  const signerTypeLabel = data.signerType === "tl_corp_rep"
    ? "TL Corp Representative"
    : "Building Representative";

  const workOrderUrl = `${APP_URL}/dashboard/management/work-orders/${data.workOrderId}`;

  const content = `
    <div style="background-color: #16a34a15; border-left: 4px solid #16a34a; padding: 16px; border-radius: 0 12px 12px 0; margin-bottom: 24px;">
      <p style="margin: 0; color: #16a34a; font-size: 14px; font-weight: 600; text-transform: uppercase;">
        New Signature Received
      </p>
    </div>
    <h2 style="margin: 0 0 16px; color: #01224f; font-size: 20px; font-weight: 600;">
      Work Order #${data.workOrderNumber} has been signed
    </h2>
    ${data.company || data.location ? `
    <p style="margin: 0 0 16px; color: #6b7280; font-size: 14px;">
      ${data.company ? `<strong>${data.company}</strong>` : ""}${data.company && data.location ? " - " : ""}${data.location || ""}
    </p>
    ` : ""}
    <div style="background-color: #f7f8fb; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <p style="margin: 0 0 8px; color: #6b7280; font-size: 12px; text-transform: uppercase;">Signed By</p>
      <p style="margin: 0; color: #01224f; font-size: 18px; font-weight: 600;">
        ${data.signerName}
      </p>
      ${data.signerTitle ? `<p style="margin: 4px 0 0; color: #6b7280; font-size: 14px;">${data.signerTitle}</p>` : ""}
      <p style="margin: 8px 0 0; color: #01224f; font-size: 14px; font-weight: 500;">
        ${signerTypeLabel}
      </p>
    </div>
    <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px;">
      Signed on: <strong>${new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</strong>
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td align="center">
          <a href="${workOrderUrl}" style="display: inline-block; padding: 14px 28px; background-color: #01224f; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; border-radius: 12px;">
            View Work Order & Signatures
          </a>
        </td>
      </tr>
    </table>
  `;

  return sendEmail({
    to: emails,
    subject: `[Signature Received] WO #${data.workOrderNumber} - ${signerTypeLabel}`,
    html: getEmailTemplate(content, "Signature Alert"),
  });
}

// ============ MANAGEMENT CONTRACT SIGNATURE ALERT ============

export async function sendManagementSignatureAlertEmail(data: {
  projectId: string;
  projectName: string;
  signerName: string;
  signerEmail?: string;
  documentName: string;
}): Promise<boolean> {
  // Get all associated emails for the project
  const emails = await getProjectAssociatedEmails(data.projectId);
  const adminEmails = await getAdminEmails();
  const allEmails = [...new Set([...emails, ...adminEmails])];

  if (allEmails.length === 0) return true;

  const projectUrl = `${APP_URL}/dashboard/projects/${data.projectId}`;

  const content = `
    <div style="background-color: #16a34a15; border-left: 4px solid #16a34a; padding: 16px; border-radius: 0 12px 12px 0; margin-bottom: 24px;">
      <p style="margin: 0; color: #16a34a; font-size: 14px; font-weight: 600; text-transform: uppercase;">
        Contract Signed
      </p>
    </div>
    <h2 style="margin: 0 0 16px; color: #01224f; font-size: 20px; font-weight: 600;">
      Management Contract Signature Received
    </h2>
    <p style="margin: 0 0 16px; color: #0d3e8d; font-size: 16px; line-height: 1.6;">
      A signature has been received for the project <strong>${data.projectName}</strong>.
    </p>
    <div style="background-color: #f7f8fb; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <p style="margin: 0 0 8px; color: #6b7280; font-size: 12px; text-transform: uppercase;">Document</p>
      <p style="margin: 0 0 16px; color: #01224f; font-size: 16px; font-weight: 600;">
        ${data.documentName}
      </p>
      <p style="margin: 0 0 8px; color: #6b7280; font-size: 12px; text-transform: uppercase;">Signed By</p>
      <p style="margin: 0; color: #01224f; font-size: 16px; font-weight: 600;">
        ${data.signerName}
      </p>
      ${data.signerEmail ? `<p style="margin: 4px 0 0; color: #6b7280; font-size: 14px;">${data.signerEmail}</p>` : ""}
    </div>
    <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px;">
      Signed on: <strong>${new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</strong>
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td align="center">
          <a href="${projectUrl}" style="display: inline-block; padding: 14px 28px; background-color: #01224f; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; border-radius: 12px;">
            View Project
          </a>
        </td>
      </tr>
    </table>
  `;

  return sendEmail({
    to: allEmails,
    subject: `[Contract Signed] ${data.documentName} - ${data.projectName}`,
    html: getEmailTemplate(content, "Contract Signature Alert"),
  });
}

// ============ GENERAL NOTIFICATION EMAIL ============

export async function sendNotificationEmail(data: {
  to: string | string[];
  subject: string;
  title: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
}): Promise<boolean> {
  const content = `
    <h2 style="margin: 0 0 16px; color: #01224f; font-size: 20px; font-weight: 600;">
      ${data.title}
    </h2>
    <p style="margin: 0 0 24px; color: #0d3e8d; font-size: 16px; line-height: 1.6;">
      ${data.message}
    </p>
    ${data.actionUrl && data.actionLabel ? `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td align="center">
          <a href="${data.actionUrl}" style="display: inline-block; padding: 14px 28px; background-color: #01224f; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; border-radius: 12px;">
            ${data.actionLabel}
          </a>
        </td>
      </tr>
    </table>
    ` : ""}
  `;

  return sendEmail({
    to: data.to,
    subject: data.subject,
    html: getEmailTemplate(content, data.title),
  });
}

// ============ WORK ORDER CUSTOMER INVITATION EMAIL ============

export async function sendWorkOrderInvitationEmail(data: {
  to: string;
  customerName: string;
  inviterName: string;
  inviteToken: string;
  workOrderNumber: string;
  company?: string;
  location?: string;
  description: string;
}): Promise<boolean> {
  const viewUrl = `${APP_URL}/customer/work-orders?token=${data.inviteToken}`;

  const content = `
    <h2 style="margin: 0 0 16px; color: #01224f; font-size: 20px; font-weight: 600;">
      You've been added to a work order!
    </h2>
    <p style="margin: 0 0 24px; color: #0d3e8d; font-size: 16px; line-height: 1.6;">
      Hi ${data.customerName}, <strong>${data.inviterName}</strong> has added you as a customer contact for the following work order:
    </p>
    <div style="background-color: #f7f8fb; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <p style="margin: 0 0 8px; color: #6b7280; font-size: 12px; text-transform: uppercase;">Work Order</p>
      <p style="margin: 0 0 12px; color: #01224f; font-size: 18px; font-weight: 600;">
        #${data.workOrderNumber}
      </p>
      ${data.company || data.location ? `
      <p style="margin: 0 0 12px; color: #6b7280; font-size: 14px;">
        ${data.company ? `<strong>${data.company}</strong>` : ""}${data.company && data.location ? " - " : ""}${data.location || ""}
      </p>
      ` : ""}
      <p style="margin: 0 0 8px; color: #6b7280; font-size: 12px; text-transform: uppercase;">Description</p>
      <p style="margin: 0; color: #01224f; font-size: 14px; line-height: 1.5;">
        ${data.description.substring(0, 200)}${data.description.length > 200 ? "..." : ""}
      </p>
    </div>
    <p style="margin: 0 0 24px; color: #0d3e8d; font-size: 16px; line-height: 1.6;">
      You will receive updates about this work order. Click below to view the details.
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td align="center">
          <a href="${viewUrl}" style="display: inline-block; padding: 16px 32px; background-color: #01224f; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 12px;">
            View Work Order
          </a>
        </td>
      </tr>
    </table>
    <p style="margin: 32px 0 0; color: #7ba8b3; font-size: 14px; line-height: 1.6;">
      This link will expire in 30 days.
    </p>
  `;

  return sendEmail({
    to: data.to,
    subject: `Work Order #${data.workOrderNumber} - You've been added as a contact`,
    html: getEmailTemplate(content, "Work Order Invitation"),
  });
}
