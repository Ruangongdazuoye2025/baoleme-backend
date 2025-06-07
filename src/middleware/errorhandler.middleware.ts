import { NextFunction, Request, Response } from 'express'
import Joi from 'joi'

export async function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
    if (typeof(err.status) === 'number' && typeof(err.message) === 'string') {
        res.status(err.status).json({ message: err.message })
    } else if (err.error instanceof Joi.ValidationError) {
        if (process.env.NODE_ENV === 'production') {
            res.status(400).json({ message: 'Invalid request' })
        } else {
            res.status(400).json({ message: 'Invalid request', error: err.error})
        }
        
    } else {
        next(err)
    }
}