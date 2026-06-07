import { sendError } from "../utils/response.js";

// Strips leading/trailing whitespace from all string body fields
const sanitize = (obj) => {
  if (!obj || typeof obj !== "object") return obj;
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v])
  );
};

export const validateAuth = (req, res, next) => {
  req.body = sanitize(req.body);
  const { email, password } = req.body;

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return sendError(res, 400, "Invalid email format");
  }
  if (password && password.length < 8) {
    return sendError(res, 400, "Password must be at least 8 characters");
  }
  next();
};

export const validateTrackUpload = (req, res, next) => {
  req.body = sanitize(req.body);
  const { title } = req.body;

  if (!title || title.length < 1 || title.length > 200) {
    return sendError(res, 400, "Title must be between 1 and 200 characters");
  }
  next();
};

export const validateArtistProfile = (req, res, next) => {
  req.body = sanitize(req.body);
  const { bio, genre } = req.body;

  if (bio && bio.length > 1000) {
    return sendError(res, 400, "Bio must be under 1000 characters");
  }
  if (genre && genre.length > 100) {
    return sendError(res, 400, "Genre must be under 100 characters");
  }
  next();
};
