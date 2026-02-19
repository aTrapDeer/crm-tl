# S3 Setup for Project Photos (`crm-tlcorp`)

This app now uploads project photos directly to S3.

Object key format:
- `projects/images/<projectId>/<timestamp>-<filename>`

Example:
- `projects/images/abc123/1739989212450-jobsite-front.jpg`

## 1. Confirm/Create Bucket

1. Open AWS S3.
2. Use bucket `crm-tlcorp` (or create it if missing).
3. Confirm region and use that same value for `AWS_REGION` in app env vars.

## 2. Create IAM User (Programmatic Access)

1. Go to IAM -> Users -> Create user.
2. Enable programmatic access (access key + secret).
3. Attach a policy limited to this bucket/prefix (example below).

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::crm-tlcorp/projects/images/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket"
      ],
      "Resource": "arn:aws:s3:::crm-tlcorp",
      "Condition": {
        "StringLike": {
          "s3:prefix": [
            "projects/images/*"
          ]
        }
      }
    }
  ]
}
```

## 3. Configure App Environment

Set these in `.env.local` (local) and in Vercel Project Environment Variables (production):

```bash
AWS_REGION=us-east-1
S3_BUCKET_NAME=crm-tlcorp
S3_KEY_PREFIX=projects/images
AWS_ACCESS_KEY_ID=YOUR_KEY
AWS_SECRET_ACCESS_KEY=YOUR_SECRET
```

## 4. Optional: Public vs Private Objects

If photo URLs should be directly viewable from browser:
- allow reads through bucket policy/CloudFront, or
- keep bucket private and serve photos via signed URLs (future enhancement).

Current UI uses `s3_url` directly.

## 5. Verify End-to-End

1. Start app: `npm run dev`
2. Open a project and upload a photo.
3. Confirm record in `project_images` has `s3_key` and `s3_url`.
4. In S3, verify object exists under `projects/images/<projectId>/...`.
5. Delete a photo from UI and confirm object is deleted from S3.

## 6. Troubleshooting

- `503 S3 is not configured`: missing one or more env vars above.
- `500 Failed to upload file to S3`: invalid IAM permissions, wrong region, or invalid credentials.
- Image doesn’t display but upload succeeded: object is private and direct URL is blocked.
