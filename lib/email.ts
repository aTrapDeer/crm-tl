// Email service using Amazon SES with nodemailer
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import nodemailer from "nodemailer";
import { turso } from "./turso";
import { formatUsCentralDateTime } from "./us-central-time";
import type { InstallmentWithAmount, EstimateBreakdown } from "./estimate";
import { formatCurrency, getCategoryLabel } from "./estimate";
import type { EstimateLineItem } from "./projects";

const AWS_REGION = process.env.AWS_REGION || "us-east-1";
const SES_FROM_EMAIL = process.env.SES_FROM_EMAIL || "no-reply@tlcorp.build";
const SES_FROM_NAME = process.env.SES_FROM_NAME || "TL-Corp";
const SES_REPLY_TO_EMAIL = process.env.SES_REPLY_TO_EMAIL;
const IS_SES_CONFIGURED = Boolean(
  process.env.AWS_ACCESS_KEY_ID &&
  process.env.AWS_SECRET_ACCESS_KEY &&
  AWS_REGION &&
  SES_FROM_EMAIL
);
// APP_URL priority: explicit APP_URL env > NEXT_PUBLIC_APP_URL > Vercel auto-set URL > localhost fallback
const APP_URL = (
  process.env.APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
  "http://localhost:3000"
).replace(/\/+$/, ""); // strip trailing slash

// Create reusable transporter
const sesClient = new SESv2Client({ region: AWS_REGION });
const transporter = IS_SES_CONFIGURED
  ? nodemailer.createTransport({
      SES: { sesClient, SendEmailCommand },
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
    console.log("📧 Email would be sent (SES not configured):");
    console.log(`   To: ${recipients.join(", ")}`);
    console.log(`   Subject: ${options.subject}`);
    console.log("   ---");
    return true;
  }

  try {
    await transporter.sendMail({
      from: `"${SES_FROM_NAME}" <${SES_FROM_EMAIL}>`,
      replyTo: SES_REPLY_TO_EMAIL || undefined,
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

export async function sendEmployeeInvitationEmail(data: {
  to: string;
  inviterName: string;
  inviteToken: string;
  employeeName?: string;
}): Promise<boolean> {
  const signupUrl = `${APP_URL}/register?employeeInvite=${data.inviteToken}`;
  const greeting = data.employeeName ? `Hi ${data.employeeName},` : "Hello,";

  const content = `
    <h2 style="margin: 0 0 16px; color: #01224f; font-size: 20px; font-weight: 600;">
      You&apos;ve been invited as an employee
    </h2>
    <p style="margin: 0 0 16px; color: #0d3e8d; font-size: 16px; line-height: 1.6;">
      ${greeting}
    </p>
    <p style="margin: 0 0 24px; color: #0d3e8d; font-size: 16px; line-height: 1.6;">
      <strong>${data.inviterName}</strong> invited you to join Taylor Leonard CRM as an employee.
    </p>
    <p style="margin: 0 0 24px; color: #0d3e8d; font-size: 16px; line-height: 1.6;">
      Use the button below to complete your account setup and onboarding.
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td align="center">
          <a href="${signupUrl}" style="display: inline-block; padding: 16px 32px; background-color: #01224f; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 12px;">
            Accept Employee Invite
          </a>
        </td>
      </tr>
    </table>
    <p style="margin: 32px 0 0; color: #7ba8b3; font-size: 14px; line-height: 1.6;">
      This invitation will expire in 7 days. If you did not expect this invite, you can ignore this email.
    </p>
  `;

  return sendEmail({
    to: data.to,
    subject: "Employee Invitation - Taylor Leonard CRM",
    html: getEmailTemplate(content, "Employee Invitation"),
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

export async function sendProjectCompletionNotification(data: {
  projectId: string;
  projectName: string;
  performedBy: string;
}): Promise<boolean> {
  const adminEmails = await getAdminEmails();
  if (adminEmails.length === 0) return true;

  const projectUrl = `${APP_URL}/dashboard/projects/${data.projectId}`;

  const content = `
    <div style="background-color: #16a34a15; border-left: 4px solid #16a34a; padding: 16px; border-radius: 0 12px 12px 0; margin-bottom: 24px;">
      <p style="margin: 0; color: #16a34a; font-size: 14px; font-weight: 600; text-transform: uppercase;">
        Project Completed
      </p>
    </div>
    <h2 style="margin: 0 0 16px; color: #01224f; font-size: 20px; font-weight: 600;">
      ${data.projectName} has been marked complete
    </h2>
    <p style="margin: 0 0 24px; color: #0d3e8d; font-size: 16px; line-height: 1.6;">
      Completion was recorded by <strong>${data.performedBy}</strong>.
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
    subject: `[Project Completed] ${data.projectName}`,
    html: getEmailTemplate(content, "Project Completion"),
  });
}

export async function sendProjectSignatureNotification(data: {
  projectId: string;
  projectName: string;
  signerName: string;
  signerRole: "admin" | "client";
}): Promise<boolean> {
  const adminEmails = await getAdminEmails();
  if (adminEmails.length === 0) return true;

  const signerRoleLabel = data.signerRole === "admin" ? "Admin" : "Client";
  const projectUrl = `${APP_URL}/dashboard/projects/${data.projectId}`;

  const content = `
    <div style="background-color: #16a34a15; border-left: 4px solid #16a34a; padding: 16px; border-radius: 0 12px 12px 0; margin-bottom: 24px;">
      <p style="margin: 0; color: #16a34a; font-size: 14px; font-weight: 600; text-transform: uppercase;">
        Project Signature Received
      </p>
    </div>
    <h2 style="margin: 0 0 16px; color: #01224f; font-size: 20px; font-weight: 600;">
      ${data.projectName}
    </h2>
    <div style="background-color: #f7f8fb; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <p style="margin: 0 0 8px; color: #6b7280; font-size: 12px; text-transform: uppercase;">Signed By</p>
      <p style="margin: 0; color: #01224f; font-size: 18px; font-weight: 600;">
        ${data.signerName}
      </p>
      <p style="margin: 8px 0 0; color: #01224f; font-size: 14px; font-weight: 500;">
        ${signerRoleLabel}
      </p>
    </div>
    <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px;">
      Signed on: <strong>${formatUsCentralDateTime(new Date())} CT</strong>
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
    subject: `[Project Signature] ${data.projectName} - ${signerRoleLabel}`,
    html: getEmailTemplate(content, "Project Signature"),
  });
}

export async function sendBonanApprovalSignatureNotification(data: {
  entityType: "bonan_report" | "work_order" | "incident_report";
  entityId: string;
  entityLabel: string;
  signerName: string;
}): Promise<boolean> {
  const adminEmails = await getAdminEmails();
  if (adminEmails.length === 0) return true;

  const entityPath =
    data.entityType === "work_order"
      ? `/dashboard/management/work-orders/${data.entityId}`
      : data.entityType === "incident_report"
        ? `/dashboard/management/incident-reports/${data.entityId}`
        : `/dashboard/management/bonan/daily/${data.entityId}`;

  const content = `
    <div style="background-color: #16a34a15; border-left: 4px solid #16a34a; padding: 16px; border-radius: 0 12px 12px 0; margin-bottom: 24px;">
      <p style="margin: 0; color: #16a34a; font-size: 14px; font-weight: 600; text-transform: uppercase;">
        Bonan Client Sign-Off Received
      </p>
    </div>
    <h2 style="margin: 0 0 16px; color: #01224f; font-size: 20px; font-weight: 600;">
      ${data.entityLabel}
    </h2>
    <p style="margin: 0 0 24px; color: #0d3e8d; font-size: 16px; line-height: 1.6;">
      <strong>${data.signerName}</strong> submitted a client approval signature for this ${data.entityType.replace("_", " ")}.
    </p>
    <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px;">
      Signed on: <strong>${formatUsCentralDateTime(new Date())} CT</strong>
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td align="center">
          <a href="${APP_URL}${entityPath}" style="display: inline-block; padding: 14px 28px; background-color: #01224f; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; border-radius: 12px;">
            Review Item
          </a>
        </td>
      </tr>
    </table>
  `;

  return sendEmail({
    to: adminEmails,
    subject: `[Bonan Sign-Off] ${data.entityLabel}`,
    html: getEmailTemplate(content, "Bonan Client Sign-Off"),
  });
}

export async function sendBonanClientDecisionNotification(data: {
  entityType: "work_order" | "incident_report";
  entityId: string;
  entityLabel: string;
  decisionStatus: "approved" | "denied";
  responderName: string;
  responseDate: string;
  note?: string | null;
}): Promise<boolean> {
  const adminEmails = await getAdminEmails();
  if (adminEmails.length === 0) return true;

  const isApproved = data.decisionStatus === "approved";
  const accentColor = isApproved ? "#16a34a" : "#dc2626";
  const accentBg = isApproved ? "#16a34a15" : "#dc262615";
  const actionLabel = isApproved ? "Client Approved" : "Client Denied";
  const entityPath =
    data.entityType === "work_order"
      ? `/dashboard/management/work-orders/${data.entityId}`
      : `/dashboard/management/incident-reports/${data.entityId}`;

  const content = `
    <div style="background-color: ${accentBg}; border-left: 4px solid ${accentColor}; padding: 16px; border-radius: 0 12px 12px 0; margin-bottom: 24px;">
      <p style="margin: 0; color: ${accentColor}; font-size: 14px; font-weight: 600; text-transform: uppercase;">
        ${actionLabel}
      </p>
    </div>
    <h2 style="margin: 0 0 16px; color: #01224f; font-size: 20px; font-weight: 600;">
      ${data.entityLabel}
    </h2>
    <p style="margin: 0 0 16px; color: #0d3e8d; font-size: 16px; line-height: 1.6;">
      <strong>${data.responderName}</strong> marked this ${data.entityType.replace("_", " ")} as <strong>${data.decisionStatus}</strong>.
    </p>
    <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px;">
      Response date: <strong>${data.responseDate}</strong><br />
      Logged at: <strong>${formatUsCentralDateTime(new Date())} CT</strong>
    </p>
    ${data.note ? `
    <div style="background-color: #f7f8fb; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <p style="margin: 0 0 8px; color: #6b7280; font-size: 12px; text-transform: uppercase;">Client Note</p>
      <p style="margin: 0; color: #01224f; font-size: 14px; line-height: 1.5;">
        ${data.note}
      </p>
    </div>
    ` : ""}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td align="center">
          <a href="${APP_URL}${entityPath}" style="display: inline-block; padding: 14px 28px; background-color: #01224f; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; border-radius: 12px;">
            Review Item
          </a>
        </td>
      </tr>
    </table>
  `;

  return sendEmail({
    to: adminEmails,
    subject: `[Bonan Client ${isApproved ? "Approved" : "Denied"}] ${data.entityLabel}`,
    html: getEmailTemplate(content, `Bonan Client ${isApproved ? "Approved" : "Denied"}`),
  });
}

export async function sendIncidentReportStatusNotification(data: {
  incidentReportId: string;
  reportNumber: string;
  sectionName: string;
  newStatus: string;
  description: string;
  performedBy: string;
  location?: string;
}): Promise<boolean> {
  const adminEmails = await getAdminEmails();
  if (adminEmails.length === 0) return true;

  const incidentUrl = `${APP_URL}/dashboard/management/incident-reports/${data.incidentReportId}`;

  const content = `
    <div style="background-color: #8b5cf615; border-left: 4px solid #8b5cf6; padding: 16px; border-radius: 0 12px 12px 0; margin-bottom: 24px;">
      <p style="margin: 0; color: #8b5cf6; font-size: 14px; font-weight: 600; text-transform: uppercase;">
        Incident Status Changed: ${data.newStatus.replace("_", " ").toUpperCase()}
      </p>
    </div>
    <h2 style="margin: 0 0 16px; color: #01224f; font-size: 20px; font-weight: 600;">
      Incident Report #${data.reportNumber}
    </h2>
    <p style="margin: 0 0 16px; color: #6b7280; font-size: 14px;">
      <strong>${data.sectionName}</strong>${data.location ? ` - ${data.location}` : ""}
    </p>
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
          <a href="${incidentUrl}" style="display: inline-block; padding: 14px 28px; background-color: #01224f; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; border-radius: 12px;">
            View Incident Report
          </a>
        </td>
      </tr>
    </table>
  `;

  return sendEmail({
    to: adminEmails,
    subject: `[Incident Status Changed] IR #${data.reportNumber}`,
    html: getEmailTemplate(content, "Incident Report Notification"),
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
  const adminEmails = await getAdminEmails();
  if (adminEmails.length === 0) return true;

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
    to: adminEmails,
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
  const adminEmails = await getAdminEmails();
  if (adminEmails.length === 0) return true;

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
    to: adminEmails,
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

// ============ CHANGE REQUEST NOTIFICATION EMAIL ============

export async function sendChangeRequestNotification(data: {
  projectId: string;
  projectName: string;
  requesterName: string;
  requesterEmail: string;
  sections: string[];
  message?: string;
}): Promise<boolean> {
  const adminEmails = await getAdminEmails();
  if (adminEmails.length === 0) return true;

  const projectUrl = `${APP_URL}/dashboard/projects/${data.projectId}`;

  const sectionLabels: Record<string, string> = {
    name: "Project Name",
    description: "Description",
    address: "Address",
    dates: "Project Dates",
    budget: "Budget & Funding",
    status: "Status",
  };

  const requestedSectionsList = data.sections
    .map((s) => sectionLabels[s] || s)
    .join(", ");

  const content = `
    <div style="background-color: #dbeafe; border-left: 4px solid #3b82f6; padding: 16px; border-radius: 0 12px 12px 0; margin-bottom: 24px;">
      <p style="margin: 0; color: #1e40af; font-size: 14px; font-weight: 600; text-transform: uppercase;">
        Change Request
      </p>
    </div>
    <h2 style="margin: 0 0 16px; color: #01224f; font-size: 20px; font-weight: 600;">
      New change request for "${data.projectName}"
    </h2>
    <p style="margin: 0 0 16px; color: #6b7280; font-size: 14px;">
      <strong>${data.requesterName}</strong> (${data.requesterEmail}) has requested permission to edit the following sections:
    </p>
    <div style="background-color: #f7f8fb; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <p style="margin: 0 0 8px; color: #6b7280; font-size: 12px; text-transform: uppercase;">Requested Sections</p>
      <p style="margin: 0; color: #01224f; font-size: 16px; font-weight: 600;">
        ${requestedSectionsList}
      </p>
      ${data.message ? `
      <p style="margin: 16px 0 0; color: #6b7280; font-size: 12px; text-transform: uppercase;">Message</p>
      <p style="margin: 4px 0 0; color: #01224f; font-size: 14px; line-height: 1.5;">
        "${data.message}"
      </p>
      ` : ""}
    </div>
    <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px;">
      Please review this request and approve or reject the sections the client can edit.
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td align="center">
          <a href="${projectUrl}" style="display: inline-block; padding: 14px 28px; background-color: #01224f; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; border-radius: 12px;">
            Review Request
          </a>
        </td>
      </tr>
    </table>
  `;

  return sendEmail({
    to: adminEmails,
    subject: `[Change Request] ${data.projectName} - ${data.requesterName}`,
    html: getEmailTemplate(content, "Change Request Notification"),
  });
}

// ============ CHANGE REQUEST APPROVAL EMAIL ============

export async function sendChangeRequestApprovalNotification(data: {
  projectId: string;
  projectName: string;
  requesterEmail: string;
  requesterName: string;
  status: "approved" | "rejected";
  approvedSections: string[];
  adminNotes?: string;
  reviewerName: string;
}): Promise<boolean> {
  const projectUrl = `${APP_URL}/dashboard/projects/${data.projectId}`;

  const sectionLabels: Record<string, string> = {
    name: "Project Name",
    description: "Description",
    address: "Address",
    dates: "Project Dates",
    budget: "Budget & Funding",
    status: "Status",
  };

  const isApproved = data.status === "approved";
  const statusColor = isApproved ? "#16a34a" : "#dc2626";
  const statusBgColor = isApproved ? "#dcfce7" : "#fee2e2";
  const statusLabel = isApproved ? "Approved" : "Rejected";

  const approvedSectionsList = data.approvedSections
    .map((s) => sectionLabels[s] || s)
    .join(", ");

  const content = `
    <div style="background-color: ${statusBgColor}; border-left: 4px solid ${statusColor}; padding: 16px; border-radius: 0 12px 12px 0; margin-bottom: 24px;">
      <p style="margin: 0; color: ${statusColor}; font-size: 14px; font-weight: 600; text-transform: uppercase;">
        Request ${statusLabel}
      </p>
    </div>
    <h2 style="margin: 0 0 16px; color: #01224f; font-size: 20px; font-weight: 600;">
      Hi ${data.requesterName}, your change request has been ${data.status}
    </h2>
    <p style="margin: 0 0 16px; color: #6b7280; font-size: 14px;">
      Your request to edit sections of <strong>"${data.projectName}"</strong> has been reviewed by ${data.reviewerName}.
    </p>
    ${isApproved && data.approvedSections.length > 0 ? `
    <div style="background-color: #f7f8fb; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <p style="margin: 0 0 8px; color: #6b7280; font-size: 12px; text-transform: uppercase;">Approved Sections</p>
      <p style="margin: 0; color: #16a34a; font-size: 16px; font-weight: 600;">
        ${approvedSectionsList}
      </p>
      <p style="margin: 16px 0 0; color: #6b7280; font-size: 14px;">
        You can now edit these sections. Click the button below to make your changes.
      </p>
    </div>
    ` : ""}
    ${data.adminNotes ? `
    <div style="background-color: #f7f8fb; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <p style="margin: 0 0 8px; color: #6b7280; font-size: 12px; text-transform: uppercase;">Admin Notes</p>
      <p style="margin: 0; color: #01224f; font-size: 14px; line-height: 1.5;">
        "${data.adminNotes}"
      </p>
    </div>
    ` : ""}
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
    to: data.requesterEmail,
    subject: `[${statusLabel}] Change Request for ${data.projectName}`,
    html: getEmailTemplate(content, "Change Request Update"),
  });
}

export async function sendUserPasswordResetEmail(data: {
  to: string;
  fullName: string;
  temporaryPassword: string;
}): Promise<boolean> {
  const loginUrl = `${APP_URL}/login`;

  const content = `
    <h2 style="margin: 0 0 16px; color: #01224f; font-size: 20px; font-weight: 600;">
      Password Reset
    </h2>
    <p style="margin: 0 0 16px; color: #0d3e8d; font-size: 16px; line-height: 1.6;">
      Hi ${data.fullName || "there"},
    </p>
    <p style="margin: 0 0 20px; color: #0d3e8d; font-size: 16px; line-height: 1.6;">
      An administrator reset your password. Use the temporary password below to sign in.
    </p>
    <div style="background-color: #f7f8fb; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <p style="margin: 0 0 8px; color: #6b7280; font-size: 12px; text-transform: uppercase;">Temporary Password</p>
      <p style="margin: 0; color: #01224f; font-size: 20px; font-weight: 700; letter-spacing: 0.06em;">
        ${data.temporaryPassword}
      </p>
    </div>
    <p style="margin: 0 0 24px; color: #0d3e8d; font-size: 15px; line-height: 1.6;">
      For security, please sign in and change your password immediately.
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td align="center">
          <a href="${loginUrl}" style="display: inline-block; padding: 16px 32px; background-color: #01224f; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 12px;">
            Go to Login
          </a>
        </td>
      </tr>
    </table>
  `;

  return sendEmail({
    to: data.to,
    subject: "Your password was reset",
    html: getEmailTemplate(content, "Password Reset"),
  });
}

export async function sendPasswordResetLinkEmail(data: {
  to: string;
  fullName: string;
  resetUrl: string;
}): Promise<boolean> {
  const content = `
    <h2 style="margin: 0 0 16px; color: #01224f; font-size: 20px; font-weight: 600;">
      Reset Your Password
    </h2>
    <p style="margin: 0 0 16px; color: #0d3e8d; font-size: 16px; line-height: 1.6;">
      Hi ${data.fullName || "there"},
    </p>
    <p style="margin: 0 0 24px; color: #0d3e8d; font-size: 16px; line-height: 1.6;">
      We received a request to reset your password. Click the button below to choose a new password.
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td align="center">
          <a href="${data.resetUrl}" style="display: inline-block; padding: 16px 32px; background-color: #01224f; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 12px;">
            Reset Password
          </a>
        </td>
      </tr>
    </table>
    <p style="margin: 24px 0 0; color: #7ba8b3; font-size: 14px; line-height: 1.6;">
      This link expires in 1 hour and can only be used once.
    </p>
    <p style="margin: 12px 0 0; color: #7ba8b3; font-size: 14px; line-height: 1.6;">
      If you did not request this, you can safely ignore this email.
    </p>
  `;

  return sendEmail({
    to: data.to,
    subject: "Reset your Taylor Leonard CRM password",
    html: getEmailTemplate(content, "Reset Password"),
  });
}

// ============ PROJECT ESTIMATE EMAILS ============

export async function sendProjectEstimateEmail(data: {
  to: string;
  projectName: string;
  clientName: string;
  grandTotal: number;
  subtotal: number;
  breakdown: EstimateBreakdown;
  lineItems: EstimateLineItem[];
  installments: InstallmentWithAmount[];
  deliveryToken: string;
  projectId: string;
  inviteToken?: string;
  hideLineItemPricing?: boolean;
  hideMarkup?: boolean;
}): Promise<boolean> {
  const hideLineItemPricing = Boolean(data.hideLineItemPricing);
  const hideMarkup = Boolean(data.hideMarkup);
  const publicEstimateUrl = `${APP_URL}/estimate/${data.deliveryToken}`;
  const crmEstimateUrl = `${APP_URL}/dashboard/projects/${data.projectId}/estimate?delivery=${data.deliveryToken}`;
  const signupUrl = data.inviteToken
    ? `${APP_URL}/register?invite=${data.inviteToken}`
    : `${APP_URL}/register`;
  const trackingPixelUrl = `${APP_URL}/api/tracking/estimate/${data.deliveryToken}/open`;

  const lineItemsHtml = data.lineItems
    .map(
      (item) => `
      <tr>
        <td style="padding: 10px 8px; border-bottom: 1px solid #e8edf4; color: #01224f; font-size: 13px; font-weight: 600;">
          ${getCategoryLabel(item)}
        </td>
        <td style="padding: 10px 8px; border-bottom: 1px solid #e8edf4; color: #0d3e8d; font-size: 13px;">
          ${item.description || "—"}
        </td>
        <td style="padding: 10px 8px; border-bottom: 1px solid #e8edf4; color: #0d3e8d; font-size: 13px; text-align: right;">
          ${item.quantity}
        </td>
        ${
          hideLineItemPricing
            ? ""
            : `<td style="padding: 10px 8px; border-bottom: 1px solid #e8edf4; color: #0d3e8d; font-size: 13px; text-align: right;">
          ${formatCurrency(item.price_rate)}
        </td>
        <td style="padding: 10px 8px; border-bottom: 1px solid #e8edf4; color: #01224f; font-size: 13px; font-weight: 600; text-align: right;">
          ${formatCurrency(item.total)}
        </td>`
        }
      </tr>`
    )
    .join("");

  const lineItemTableHeaders = hideLineItemPricing
    ? `<th style="padding: 10px 8px; text-align: left; color: #6b7280; font-size: 11px; text-transform: uppercase;">Category</th>
          <th style="padding: 10px 8px; text-align: left; color: #6b7280; font-size: 11px; text-transform: uppercase;">Description</th>
          <th style="padding: 10px 8px; text-align: right; color: #6b7280; font-size: 11px; text-transform: uppercase;">Qty</th>`
    : `<th style="padding: 10px 8px; text-align: left; color: #6b7280; font-size: 11px; text-transform: uppercase;">Category</th>
          <th style="padding: 10px 8px; text-align: left; color: #6b7280; font-size: 11px; text-transform: uppercase;">Description</th>
          <th style="padding: 10px 8px; text-align: right; color: #6b7280; font-size: 11px; text-transform: uppercase;">Qty</th>
          <th style="padding: 10px 8px; text-align: right; color: #6b7280; font-size: 11px; text-transform: uppercase;">Rate</th>
          <th style="padding: 10px 8px; text-align: right; color: #6b7280; font-size: 11px; text-transform: uppercase;">Total</th>`;

  const pricingSummaryHtml = hideLineItemPricing
    ? ""
    : `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
      <tr><td style="padding: 4px 0; color: #6b7280; font-size: 13px;">Subtotal</td><td style="padding: 4px 0; color: #0d3e8d; font-size: 13px; text-align: right;">${formatCurrency(data.subtotal)}</td></tr>
      ${!hideMarkup && data.breakdown.markup > 0 ? `<tr><td style="padding: 4px 0; color: #6b7280; font-size: 13px;">Markup</td><td style="padding: 4px 0; color: #0d3e8d; font-size: 13px; text-align: right;">+${formatCurrency(data.breakdown.markup)}</td></tr>` : ""}
      ${!hideMarkup && data.breakdown.tax > 0 ? `<tr><td style="padding: 4px 0; color: #6b7280; font-size: 13px;">Tax</td><td style="padding: 4px 0; color: #0d3e8d; font-size: 13px; text-align: right;">+${formatCurrency(data.breakdown.tax)}</td></tr>` : ""}
      ${!hideMarkup && data.breakdown.servicingFee > 0 ? `<tr><td style="padding: 4px 0; color: #6b7280; font-size: 13px;">Online servicing fee</td><td style="padding: 4px 0; color: #0d3e8d; font-size: 13px; text-align: right;">+${formatCurrency(data.breakdown.servicingFee)}</td></tr>` : ""}
      <tr><td style="padding: 8px 0 4px; color: #01224f; font-size: 14px; font-weight: 700;">Total</td><td style="padding: 8px 0 4px; color: #01224f; font-size: 14px; font-weight: 700; text-align: right;">${formatCurrency(data.grandTotal)}</td></tr>
    </table>`;

  const installmentsHtml = data.installments
    .map(
      (inst) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e8edf4; color: #0d3e8d; font-size: 13px;">${inst.label}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e8edf4; color: #0d3e8d; font-size: 13px; text-align: right;">${inst.percent}%</td>
        <td style="padding: 8px; border-bottom: 1px solid #e8edf4; color: #0d3e8d; font-size: 13px;">${inst.due_description}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e8edf4; color: #01224f; font-size: 13px; font-weight: 600; text-align: right;">${formatCurrency(inst.amount)}</td>
      </tr>`
    )
    .join("");

  const content = `
    <h2 style="margin: 0 0 16px; color: #01224f; font-size: 20px; font-weight: 600;">
      Your Project Estimate
    </h2>
    <p style="margin: 0 0 16px; color: #0d3e8d; font-size: 16px; line-height: 1.6;">
      Hi ${data.clientName},
    </p>
    <p style="margin: 0 0 24px; color: #0d3e8d; font-size: 16px; line-height: 1.6;">
      Taylor Leonard Construction Corp. has prepared an estimate for <strong>${data.projectName}</strong>.
      ${hideLineItemPricing ? "Your total and payment schedule are below — scope details are included without per-line pricing." : "The full breakdown is below — no account required to view."}
    </p>

    <div style="background-color: #01224f; border-radius: 12px; padding: 20px; margin-bottom: 24px; text-align: center;">
      <p style="margin: 0 0 4px; color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Total Estimate</p>
      <p style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700;">${formatCurrency(data.grandTotal)}</p>
    </div>

    <h3 style="margin: 0 0 12px; color: #01224f; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em;">Scope &amp; Line Items</h3>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px; border: 1px solid #e8edf4; border-radius: 8px; overflow: hidden;">
      <thead>
        <tr style="background-color: #f7f8fb;">
          ${lineItemTableHeaders}
        </tr>
      </thead>
      <tbody>${lineItemsHtml}</tbody>
    </table>

    ${pricingSummaryHtml}

    <h3 style="margin: 0 0 12px; color: #01224f; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em;">Payment Schedule</h3>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 28px; border: 1px solid #e8edf4; border-radius: 8px; overflow: hidden;">
      <thead>
        <tr style="background-color: #f7f8fb;">
          <th style="padding: 8px; text-align: left; color: #6b7280; font-size: 11px; text-transform: uppercase;">Milestone</th>
          <th style="padding: 8px; text-align: right; color: #6b7280; font-size: 11px; text-transform: uppercase;">%</th>
          <th style="padding: 8px; text-align: left; color: #6b7280; font-size: 11px; text-transform: uppercase;">Due</th>
          <th style="padding: 8px; text-align: right; color: #6b7280; font-size: 11px; text-transform: uppercase;">Amount</th>
        </tr>
      </thead>
      <tbody>${installmentsHtml}</tbody>
    </table>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 16px;">
      <tr>
        <td align="center">
          <a href="${publicEstimateUrl}" style="display: inline-block; padding: 16px 32px; background-color: #01224f; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 12px;">
            View Full Estimate Online
          </a>
        </td>
      </tr>
    </table>
    ${
      data.inviteToken
        ? `<p style="margin: 0 0 16px; color: #0d3e8d; font-size: 14px; line-height: 1.6; text-align: center;">
             Want ongoing project updates? <a href="${signupUrl}" style="color: #01224f; font-weight: 600;">Create your CRM account</a> using this email.
           </p>`
        : `<p style="margin: 0 0 16px; color: #7ba8b3; font-size: 13px; line-height: 1.6; text-align: center;">
             Already have an account? <a href="${crmEstimateUrl}" style="color: #01224f;">View in CRM</a>
           </p>`
    }
    <img src="${trackingPixelUrl}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;" />
  `;

  return sendEmail({
    to: data.to,
    subject: `Project Estimate: ${data.projectName} — ${formatCurrency(data.grandTotal)}`,
    html: getEmailTemplate(content, "Project Estimate"),
  });
}

export async function sendEstimateEmailOpenedNotification(data: {
  projectId: string;
  recipientEmail: string;
  recipientName?: string;
}): Promise<boolean> {
  const adminEmails = await getAdminEmails();
  if (adminEmails.length === 0) return true;

  const projectUrl = `${APP_URL}/dashboard/projects/${data.projectId}`;

  const content = `
    <div style="background-color: #2563eb15; border-left: 4px solid #2563eb; padding: 16px; border-radius: 0 12px 12px 0; margin-bottom: 24px;">
      <p style="margin: 0; color: #2563eb; font-size: 14px; font-weight: 600; text-transform: uppercase;">
        Estimate Email Opened
      </p>
    </div>
    <p style="margin: 0 0 16px; color: #0d3e8d; font-size: 16px; line-height: 1.6;">
      ${data.recipientName || data.recipientEmail} opened the estimate notification email.
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
    subject: `Estimate email opened — ${data.recipientName || data.recipientEmail}`,
    html: getEmailTemplate(content, "Estimate Email Opened"),
  });
}

export async function sendEstimateViewedNotification(data: {
  projectId: string;
  projectName: string;
  viewerName: string;
  viewerEmail: string;
  viewerRole: string;
}): Promise<boolean> {
  const adminEmails = await getAdminEmails();
  if (adminEmails.length === 0) return true;

  const estimateUrl = `${APP_URL}/dashboard/projects/${data.projectId}/estimate`;

  const content = `
    <div style="background-color: #16a34a15; border-left: 4px solid #16a34a; padding: 16px; border-radius: 0 12px 12px 0; margin-bottom: 24px;">
      <p style="margin: 0; color: #16a34a; font-size: 14px; font-weight: 600; text-transform: uppercase;">
        Estimate Viewed in CRM
      </p>
    </div>
    <p style="margin: 0 0 16px; color: #0d3e8d; font-size: 16px; line-height: 1.6;">
      <strong>${data.viewerName}</strong> (${data.viewerRole}) opened the estimate for <strong>${data.projectName}</strong>.
    </p>
    <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px;">
      ${data.viewerEmail}
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td align="center">
          <a href="${estimateUrl}" style="display: inline-block; padding: 14px 28px; background-color: #01224f; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; border-radius: 12px;">
            View Estimate
          </a>
        </td>
      </tr>
    </table>
  `;

  return sendEmail({
    to: adminEmails,
    subject: `Estimate viewed — ${data.viewerName} — ${data.projectName}`,
    html: getEmailTemplate(content, "Estimate Viewed"),
  });
}
