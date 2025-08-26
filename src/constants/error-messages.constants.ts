/**
 * Standardized error messages used throughout the application
 */

export const ERROR_MESSAGES = {
    // Authentication & Authorization
    UNAUTHORIZED: 'Unauthorized',
    PERMISSION_DENIED: 'Permission denied',
    INVALID_CREDENTIALS: 'Invalid credentials',
    
    // User related
    USER_NOT_FOUND: 'User not found',
    USER_NOT_VERIFIED: 'User not verified',
    EMAIL_ALREADY_EXISTS: 'Email already exists',
    OLD_PASSWORD_WRONG: 'Old password is wrong',
    
    // Shop related
    SHOP_NOT_FOUND: 'Shop not found',
    SHOP_CATEGORY_NOT_FOUND: 'Shop category not found',
    SHOP_STATUS_CONFLICT: 'Shop status conflicts',
    
    // Item related
    ITEM_NOT_FOUND: 'Item not found',
    ITEM_CATEGORY_NOT_FOUND: 'Item category not found',
    
    // Order related
    ORDER_NOT_FOUND: 'Order not found',
    ORDER_STATUS_CONFLICT: 'Order status conflicts',
    
    // Cart related
    CART_ITEM_NOT_FOUND: 'Cart item not found',
    
    // Address related
    ADDRESS_NOT_FOUND: 'Address not found',
    
    // Review related
    REVIEW_NOT_FOUND: 'Review not found',
    
    // File/Image related
    FILE_REQUIRED: 'File is required',
    FILE_TOO_LARGE: 'File too large',
    INVALID_IMAGE_FORMAT: 'Invalid image format',
    UNACCEPTABLE_MIME_TYPE: 'Unacceptable MIME type',
    
    // Generic
    RESOURCE_NOT_FOUND: 'Resource not found',
    INVALID_REQUEST: 'Invalid request',
    VALIDATION_FAILED: 'Validation failed',
    INTERNAL_ERROR: 'Internal server error',
    
    // Request specific
    CANNOT_LOGIN: 'Cannot login',
} as const

// Type for error message keys
export type ErrorMessageKey = keyof typeof ERROR_MESSAGES
