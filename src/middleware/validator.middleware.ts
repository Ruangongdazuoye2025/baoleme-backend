import { NextFunction, Request, Response } from 'express'
import { createValidator } from 'express-joi-validation'
import { Schema } from 'joi'
import { ResponseError } from '../util/errors'
import Joi from 'joi'
import sharp from 'sharp'

const validator = createValidator({ passError: true })

export function validateBody(schema: Schema) {
    return validator.body(schema)
}

export function validateQuery(schema: Schema) {
    return validator.query(schema)
}

export function validateParams(schema: Schema) {
    return validator.params(schema)
}

export function validateHeaders(schema: Schema) {
    return validator.headers(schema)
}

export function requireFile() {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.file) {
            next(new ResponseError(401, 'Invalid request'))
        } else {
            next()
        }
    }
}

async function testFile(req: Request, cb: (file: Express.Multer.File) => any) {
    if (req.file) {
        await cb(req.file)
    }
    if (req.files) {
        for (const index in req.files) {
            const file = (req.files as any)[index] as Express.Multer.File
            await cb(file)
        }
    }
}

export function acceptMimeTypes(mimeTypes: RegExp | string[]) {
    return async (req: Request, res: Response, next: NextFunction) => {
        let validator = Joi.string()
        if (mimeTypes instanceof RegExp) {
            validator = validator.regex(mimeTypes)
        } else {
            validator = validator.allow(...mimeTypes)
        }
        await testFile(req, file => {
            if (validator.validate(file.mimetype).error)
                throw new ResponseError(401, 'Unacceptable MIME type')
        })
        next()
    }
}

export function acceptMaximumSize(size: number) {
    return async (req: Request, res: Response, next: NextFunction) => {
        await testFile(req, file => {
            if (Joi.number().max(size).validate(file.size).error) {
                throw new ResponseError(413, 'File too large')
            }
        })
        next()
    }
}

export function validateImage() {
    return async (req: Request, res: Response, next: NextFunction) => {
        await testFile(req, async file => {
            try {
                await sharp(file.buffer!).metadata()
            } catch (e) {
                throw new ResponseError(401, 'Invalid image format')
            }
        })
        next()
    }
}