import { NextFunction, Request, Response } from 'express'
import { createValidator } from 'express-joi-validation'
import { Schema } from 'joi'
import { ValidationUtils } from '../util/validation.util'

const validator = createValidator({ passError: true })

export function validateBody(schema: Schema) {
    return validator.body(schema)
}

export function validateQuery(schema: Schema) {
    return (req: Request, res: Response, next: NextFunction) => {
        const ret = schema.validate(req.query)
        if (ret.error) {
            next(ret)
        } else {
            const url = new URL(req.url, `http://localhost`)
            url.search = new URLSearchParams(ret.value as Record<string, string>).toString()
            req.url = url.pathname + (url.search ? `${url.search}` : '')
            next()
        }
    }
}

export function validateParams(schema: Schema) {
    return validator.params(schema)
}

export function validateHeaders(schema: Schema) {
    return validator.headers(schema)
}

// Re-export validation utilities for convenience
export const requireFile = ValidationUtils.requireFile
export const acceptMimeTypes = ValidationUtils.acceptMimeTypes
export const acceptMaximumSize = ValidationUtils.acceptMaximumSize
export const validateImage = ValidationUtils.validateImage