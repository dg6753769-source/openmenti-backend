// Single source of truth for all platform-wide constants
export const PLATFORM_FEE_PERCENT = Number(process.env.PLATFORM_FEE_PERCENT) || 10;
export const ARTIST_SHARE_PERCENT = 100 - PLATFORM_FEE_PERCENT;

export const SIGNED_URL_TTL_SECONDS = 4 * 60 * 60; // 4 hours

export const LIVING_ROOM_DEFAULT_PRICE_PAISE = 19900; // ₹199
export const MEMBERSHIP_PERIOD_DAYS = 30;

export const UPLOAD_LIMITS = {
  audio: 50 * 1024 * 1024,      // 50 MB
  living_room: 100 * 1024 * 1024, // 100 MB
  cover: 5 * 1024 * 1024,        // 5 MB
};

export const PAGINATION = {
  defaultLimit: 20,
  maxLimit: 100,
};
