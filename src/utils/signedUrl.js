import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import s3, { BUCKET } from "../config/storage.js";

// Generates a 4-hour signed URL for vault/protected content
export const generateSignedUrl = async (key, expiresInSeconds = 14400) => {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
};

// Public CDN URL for previews and artwork (no auth required)
export const getPublicUrl = (key) =>
  `${process.env.R2_PUBLIC_URL}/${key}`;
