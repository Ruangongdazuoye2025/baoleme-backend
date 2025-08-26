import { NextFunction, Request, Response } from 'express'
import Joi from 'joi'
import { HTTP_STATUS } from '../constants/app.constants'

export async function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
    // Handle custom ResponseError
    if (typeof err.status === 'number' && typeof err.message === 'string') {
        res.status(err.status).json({ message: err.message })
        return
    }
    
    // Handle Joi validation errors
    if (err.error instanceof Joi.ValidationError) {
        if (process.env.NODE_ENV === 'production') {
            res.status(HTTP_STATUS.BAD_REQUEST).json({ message: 'Invalid request' })
        } else {
            res.status(HTTP_STATUS.BAD_REQUEST).json({ 
                message: 'Invalid request', 
                error: err.error 
            })
        }
        return
    }
    
    // Let Express handle other errors
    next(err)
}