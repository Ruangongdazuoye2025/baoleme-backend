import { Request, Response, NextFunction } from 'express'
import { Schema } from 'joi'
import { ResponseError } from '../util/errors'
import sharp from 'sharp'

/**
 * Validation utilities for common request validation patterns
 */
export class ValidationUtils {
    
    /**
     * Validate that a required file is present in the request
     */
    static requireFile() {
        return (req: Request, res: Response, next: NextFunction) => {
            if (!req.file) {
                next(new ResponseError(400, 'File is required'))
            } else {
                next()
            }
        }
    }

    /**
     * Validate file MIME types
     */
    static acceptMimeTypes(mimeTypes: RegExp | string[]) {
        return async (req: Request, res: Response, next: NextFunction) => {
            try {
                await ValidationUtils.testFiles(req, file => {
                    const isValid = mimeTypes instanceof RegExp 
                        ? mimeTypes.test(file.mimetype)
                        : mimeTypes.includes(file.mimetype)
                    
                    if (!isValid) {
                        throw new ResponseError(400, 'Unacceptable MIME type')
                    }
                })
                next()
            } catch (error) {
                next(error)
            }
        }
    }

    /**
     * Validate maximum file size
     */
    static acceptMaximumSize(maxSizeBytes: number) {
        return async (req: Request, res: Response, next: NextFunction) => {
            try {
                await ValidationUtils.testFiles(req, file => {
                    if (file.size > maxSizeBytes) {
                        throw new ResponseError(413, 'File too large')
                    }
                })
                next()
            } catch (error) {
                next(error)
            }
        }
    }

    /**
     * Validate that uploaded files are valid images
     */
    static validateImage() {
        return async (req: Request, res: Response, next: NextFunction) => {
            try {
                await ValidationUtils.testFiles(req, async file => {
                    try {
                        await sharp(file.buffer!).metadata()
                    } catch (e) {
                        throw new ResponseError(400, 'Invalid image format')
                    }
                })
                next()
            } catch (error) {
                next(error)
            }
        }
    }

    /**
     * Helper to iterate over all files in a request
     */
    private static async testFiles(req: Request, testFn: (file: Express.Multer.File) => any | Promise<any>) {
        const files: Express.Multer.File[] = []
        
        if (req.file) {
            files.push(req.file)
        }
        
        if (req.files) {
            if (Array.isArray(req.files)) {
                files.push(...req.files)
            } else {
                Object.values(req.files).forEach(fileArray => {
                    if (Array.isArray(fileArray)) {
                        files.push(...fileArray)
                    } else {
                        files.push(fileArray)
                    }
                })
            }
        }

        for (const file of files) {
            await testFn(file)
        }
    }
}
