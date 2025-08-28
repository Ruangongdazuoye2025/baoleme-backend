/**
 * Application-wide constants
 */

// Authentication
export const AUTH_CONSTANTS = {
    SALT_ROUNDS: 10,
    PASSWORD_MIN_LENGTH: 6,
} as const

// File upload limits
export const FILE_CONSTANTS = {
    MAX_AVATAR_SIZE: 4 * 1024 * 1024, // 4MB
    AVATAR_THUMBNAIL_SIZE: 128,
    IMAGE_FORMAT: 'webp' as const,
    IMAGE_CONTENT_TYPE: 'image/webp',
} as const

// Database
export const DB_CONSTANTS = {
    USER_CLEANUP_INTERVAL_HOURS: 1,
    UNVERIFIED_USER_EXPIRY_HOURS: 1,
} as const

// HTTP Status Codes
export const HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    PAYLOAD_TOO_LARGE: 413,
    INTERNAL_SERVER_ERROR: 500,
} as const

// Default values
export const DEFAULTS = {
    USER_NAME_PREFIX: 'User ',
    USER_NAME_ID_LENGTH: 8,
} as const

export const USER_NAME_PREFIX = 'User ';
export const USER_NAME_ID_LENGTH = 8;
export const SALT_ROUNDS = 10;
export const PASSWORD_MIN_LENGTH = 6;