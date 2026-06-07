import crypto from "crypto";
import { sendError } from "../utils/response.js";

// Razorpay sends X-Razorpay-Signature header — we verify before any DB write
export const verifyRazorpayWebhook = (req, res, next) => {
  const signature = req.headers["x-razorpay-signature"];
  if (!signature) {
    return sendError(res, 400, "Missing webhook signature");
  }

  const expectedSig = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(JSON.stringify(req.body))
    .digest("hex");

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
    return sendError(res, 400, "Invalid webhook signature");
  }

  next();
};
