import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import s3, { BUCKET } from "../config/storage.js";
import { SIGNED_URL_TTL_SECONDS } from "../config/constants.js";

export const generateSignedUrl = async (key, expiresInSeconds = SIGNED_URL_TTL_SECONDS) => {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
};

export const getPublicUrl = (key) => `${process.env.R2_PUBLIC_URL}/${key}`;
