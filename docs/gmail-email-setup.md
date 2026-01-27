# Gmail Email Setup with App Password - Implementation Guide

## Overview
This guide provides step-by-step instructions for setting up Gmail email sending using an app password and implementing it into the Taylor Leonard CRM application for sending alerts and notifications.

## Prerequisites
- A Gmail account
- 2-Step Verification enabled on your Gmail account
- Access to your Google Account settings
- Node.js project with Next.js (already set up)

---

## Part 1: Setting Up Gmail App Password

### Step 1: Enable 2-Step Verification
1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Under "Signing in to Google", click **2-Step Verification**
3. Follow the prompts to enable 2-Step Verification if not already enabled
4. You'll need a phone number for verification

### Step 2: Generate App Password
1. Go back to [Google Account Security](https://myaccount.google.com/security)
2. Under "Signing in to Google", find **App passwords** (you may need to search for it)
3. If you don't see "App passwords":
   - Make sure 2-Step Verification is enabled
   - You may need to click "2-Step Verification" first, then look for "App passwords" link
4. Click **App passwords**
5. You may be prompted to sign in again
6. Select app: Choose **Mail**
7. Select device: Choose **Other (Custom name)**
8. Enter a name like "Taylor Leonard CRM" or "CRM Application"
9. Click **Generate**
10. **IMPORTANT**: Copy the 16-character password immediately (format: xxxx xxxx xxxx xxxx)
   - You won't be able to see it again
   - Remove spaces when using it (xxxx xxxx xxxx xxxx becomes xxxxxxxxxxxxxxxx)

### Step 3: Save Your Credentials
- **Gmail Address**: Your full Gmail address (e.g., `yourname@gmail.com`)
- **App Password**: The 16-character password you just generated (without spaces)

---

## Part 2: Environment Variables Setup

### Required Environment Variables
Add the following to your `.env.local` file:

```env
# Gmail SMTP Configuration
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-16-character-app-password
GMAIL_FROM_NAME=Taylor Leonard CRM

# Optional: Override SMTP settings (defaults provided)
# GMAIL_SMTP_HOST=smtp.gmail.com
# GMAIL_SMTP_PORT=587
```

### Security Notes
- **NEVER commit `.env.local` to version control** (should already be in `.gitignore`)
- Keep your app password secure and private
- If compromised, revoke the app password and generate a new one

---

## Part 3: Implementation Steps for LLM

### Step 1: Install Required Dependencies
Install `nodemailer` and its TypeScript types:

```bash
npm install nodemailer
npm install --save-dev @types/nodemailer
```

### Step 2: Update `lib/email.ts`
Replace the current Resend-based implementation with Gmail SMTP using nodemailer.

**Key Changes:**
1. Remove Resend API dependency
2. Add nodemailer import and configuration
3. Update `sendEmail` function to use SMTP
4. Keep all existing email functions (e.g., `sendInvitationEmail`) with same interface
5. Maintain backward compatibility - check for Gmail config, fallback to console logging if not configured

**Implementation Requirements:**
- Use nodemailer's `createTransport` with Gmail SMTP settings
- SMTP Host: `smtp.gmail.com`
- SMTP Port: `587` (TLS)
- Use `GMAIL_USER` for auth user
- Use `GMAIL_APP_PASSWORD` for auth password
- From address should use `GMAIL_FROM_NAME` or default to "Taylor Leonard CRM"
- Keep the same `SendEmailOptions` interface
- Keep the same return type (`Promise<boolean>`)
- Maintain error handling and logging

### Step 3: Test Email Functionality
After implementation:
1. Verify environment variables are set correctly
2. Test sending an invitation email
3. Check Gmail sent folder to confirm delivery
4. Verify email formatting is preserved

### Step 4: Update Documentation
- Update any README or documentation mentioning Resend
- Note that Gmail app password is now required
- Document the new environment variables

---

## Part 4: Code Structure Reference

### Current Email Functions (to preserve):
- `sendEmail(options: SendEmailOptions): Promise<boolean>`
- `sendInvitationEmail(data): Promise<boolean>`

### Environment Variables to Use:
- `GMAIL_USER` - Gmail email address
- `GMAIL_APP_PASSWORD` - 16-character app password
- `GMAIL_FROM_NAME` - Display name for sender (optional, defaults to "Taylor Leonard CRM")
- `NEXT_PUBLIC_APP_URL` - Already exists, used for invitation links

### SMTP Configuration:
```typescript
{
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
}
```

---

## Part 5: Troubleshooting

### Common Issues:

1. **"Invalid login credentials"**
   - Verify app password is correct (no spaces)
   - Ensure 2-Step Verification is enabled
   - Check that you're using the app password, not your regular Gmail password

2. **"Connection timeout"**
   - Check firewall settings
   - Verify SMTP port 587 is not blocked
   - Try port 465 with `secure: true` as alternative

3. **"Authentication failed"**
   - Regenerate app password
   - Ensure environment variables are loaded correctly
   - Check for extra spaces in `.env.local`

4. **Emails going to spam**
   - This is normal for new sending addresses
   - Consider using a custom domain with Gmail Workspace for better deliverability
   - Ensure proper email formatting and content

5. **"Less secure app access" error**
   - This shouldn't occur with app passwords
   - If you see this, you're using regular password instead of app password

---

## Part 6: Security Best Practices

1. **App Password Security:**
   - Never share app passwords
   - Revoke unused app passwords
   - Use different app passwords for different applications
   - Rotate app passwords periodically

2. **Environment Variables:**
   - Keep `.env.local` in `.gitignore`
   - Use different credentials for development and production
   - Consider using a secrets management service for production

3. **Rate Limiting:**
   - Gmail has sending limits (500 emails/day for free accounts)
   - Implement rate limiting in your application
   - Consider Gmail Workspace for higher limits

4. **Email Content:**
   - Include unsubscribe links for marketing emails
   - Follow CAN-SPAM and GDPR requirements
   - Use proper email headers

---

## Part 7: Migration Checklist

When implementing, ensure:
- [ ] Dependencies installed (`nodemailer` and `@types/nodemailer`)
- [ ] Environment variables added to `.env.local`
- [ ] `lib/email.ts` updated with Gmail SMTP configuration
- [ ] All existing email functions still work
- [ ] Error handling is in place
- [ ] Test email sent successfully
- [ ] Email formatting preserved
- [ ] Documentation updated

---

## Part 8: Future Enhancements

Consider these improvements for production:
1. **Email Queue System**: Use a job queue (Bull, BullMQ) for reliable email delivery
2. **Email Templates**: Create reusable template system
3. **Email Logging**: Log all sent emails to database for tracking
4. **Retry Logic**: Implement retry mechanism for failed sends
5. **Email Service Provider**: Consider using SendGrid, Mailgun, or AWS SES for production scale
6. **Custom Domain**: Set up custom domain email for better deliverability

---

## Quick Reference

### Gmail SMTP Settings:
- **Host**: smtp.gmail.com
- **Port**: 587 (TLS) or 465 (SSL)
- **Security**: STARTTLS (port 587) or SSL (port 465)
- **Authentication**: Required (use app password)

### Environment Variables Template:
```env
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=xxxxxxxxxxxxxxxx
GMAIL_FROM_NAME=Taylor Leonard CRM
```

### Testing Command:
After implementation, test by triggering an invitation email through the application UI or API.

---

## Notes for LLM Implementation

When implementing this:
1. Read the current `lib/email.ts` file completely
2. Preserve all existing function signatures and interfaces
3. Replace Resend API calls with nodemailer SMTP
4. Maintain the same error handling pattern
5. Keep console logging for development when credentials are missing
6. Test that invitation emails still work after changes
7. Ensure TypeScript types are correct
8. Verify no breaking changes to calling code

---

**Last Updated**: January 2026
**Version**: 1.0
