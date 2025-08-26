import { Request, Response, NextFunction } from 'express'
import { ResponseError } from '../util/errors'
import { ApiResponse } from '../util/api-response.util'

export async function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
    if (err instanceof ResponseError) {
        return ApiResponse.error(res, err.message, err.status)
    }
    
    console.error('Unhandled error:', err)
    return ApiResponse.error(res, 'Internal server error', 500)
}