import { Response } from 'express'
import { HTTP_STATUS } from '../constants/app.constants'

/**
 * Standardized API response utilities
 */
export class ApiResponse {
    
    /**
     * Send a successful response with data
     */
    static success<T>(res: Response, data: T, status = HTTP_STATUS.OK) {
        return res.status(status).json({
            success: true,
            data
        })
    }

    /**
     * Send a successful response without data
     */
    static successNoContent(res: Response) {
        return res.status(HTTP_STATUS.NO_CONTENT).send()
    }

    /**
     * Send a successful creation response
     */
    static created<T>(res: Response, data: T) {
        return res.status(HTTP_STATUS.CREATED).json({
            success: true,
            data
        })
    }

    /**
     * Send an error response
     */
    static error(res: Response, message: string, status: number = HTTP_STATUS.BAD_REQUEST, details?: any) {
        const response: any = {
            success: false,
            error: {
                message
            }
        }

        if (details && process.env.NODE_ENV !== 'production') {
            response.error.details = details
        }

        return res.status(status).json(response)
    }

    /**
     * Send a validation error response
     */
    static validationError(res: Response, errors: any) {
        return ApiResponse.error(res, 'Validation failed', HTTP_STATUS.BAD_REQUEST, errors)
    }

    /**
     * Send an unauthorized error response
     */
    static unauthorized(res: Response, message = 'Unauthorized') {
        return ApiResponse.error(res, message, HTTP_STATUS.UNAUTHORIZED)
    }

    /**
     * Send a forbidden error response
     */
    static forbidden(res: Response, message = 'Forbidden') {
        return ApiResponse.error(res, message, HTTP_STATUS.FORBIDDEN)
    }

    /**
     * Send a not found error response
     */
    static notFound(res: Response, message = 'Resource not found') {
        return ApiResponse.error(res, message, HTTP_STATUS.NOT_FOUND)
    }
}
