import crypto from "crypto";
import { sendError } from "../utils/response.js";

// Razorpay HMAC must be computed on the raw request body string — not re-serialized JSON
export const verifyRazorpayWebhook = (req, res, next) => {
  const signature = req.headers["x-razorpay-signature"];
  if (!signature) {
    return sendError(res, 400, "Missing webhook signature");
  }

  const rawBody = req.rawBody;
  if (!rawBody) {
    return sendError(res, 400, "Missing raw body — webhook middleware misconfigured");
  }

  const expectedSig = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
    return sendError(res, 400, "Invalid webhook signature");
  }

  next();
};
