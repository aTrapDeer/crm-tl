// Email service using Resend
// TODO: Configure Resend API key in .env.local as RESEND_API_KEY

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.log("📧 Email would be sent (Resend not configured):");
    console.log(`   To: ${options.to}`);
    console.log(`   Subject: ${options.subject}`);
    console.log("   ---");
    return true; // Return true to not block the flow
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Taylor Leonard CRM <noreply@yourdomain.com>", // Update with your verified domain
        to: options.to,
        subject: options.subject,
        html: options.html,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Failed to send email:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
}

export async function sendInvitationEmail(data: {
  to: string;
  projectName: string;
  inviterName: string;
  inviteToken: string;
}): Promise<boolean> {
  const signupUrl = `${APP_URL}/register?invite=${data.inviteToken}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>You've been invited to a project</title>
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
                    Click the button below to create your account and get access to this project. You'll be able to view project updates, tasks, and more.
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

  return sendEmail({
    to: data.to,
    subject: `You've been invited to join "${data.projectName}"`,
    html,
  });
}
