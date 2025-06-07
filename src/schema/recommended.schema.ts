import Joi from 'joi'

export const getRecommendedShopsQuery = Joi.object({
    p: Joi.number().integer().min(0).default(0).optional(),
    pn: Joi.number().integer().min(1).max(100).default(10).optional(),
    q: Joi.string().allow('').default('').optional(),
    c: Joi.alternatives().try(
        Joi.string(),
        Joi.array().items(Joi.string())
    ).optional(),
    d: Joi.number().min(0).optional(),
    r: Joi.number().integer().min(0).max(50).optional(),
    t: Joi.number().integer().min(0).optional(),
    s: Joi.string().valid('c', 't', 'r').default('c').optional(),
    rc: Joi.number().integer().min(0).max(5).default(0).optional(),
    a: Joi.string().uuid().optional(),
}).required()

export interface GetRecommendedShopsQuery {
    p: string
    pn: string
    q: string
    c?: string | string[]
    d?: string
    r?: string
    t?: string
    s: 'c' | 't' | 'r'
    rc: string
    a?: string
}