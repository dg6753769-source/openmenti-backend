import jwt from "jsonwebtoken";
import { sendError } from "../utils/response.js";

export const authenticate = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return sendError(res, 401, "No token provided");
  }

  const token = header.split(" ")[1];
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return sendError(res, 401, "Invalid or expired token");
  }
};

export const requireRole = (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return sendError(res, 403, "Insufficient permissions");
    }
    next();
  };
