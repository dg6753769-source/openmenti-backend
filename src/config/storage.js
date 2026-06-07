import { S3Client } from "@aws-sdk/client-s3";

// Cloudflare R2 is S3-compatible; swap endpoint for AWS S3 if needed
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

export const BUCKET = process.env.R2_BUCKET_NAME || "openmenti-media";
export const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

export default s3;
