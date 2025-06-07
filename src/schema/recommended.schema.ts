import Joi from 'joi'

export const getRecommendedShopsQuery = Joi.object({
    p: Joi.number().integer().min(0).default(0).optional(),
    pn: Joi.number().integer().min(1).max(100).default(10).optional(),
    q: Joi.string().allow('').default('').optional(),
    c: Joi.alternatives().try(
        Joi.string().allow('').default(''),
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

export const getRecommendedItemsQuery = Joi.object({
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
    s: Joi.string().valid('c', 't', 'r', 's').default('c').optional(),
    a: Joi.string().uuid().optional(),
    min_p: Joi.number().min(0).optional(),
    max_p: Joi.number().min(0).optional(),
}).required()

export interface GetRecommendedItemsQuery {
    p: string
    pn: string
    q: string
    c?: string | string[]
    d?: string
    r?: string
    t?: string
    s: 'c' | 't' | 'r' | 's'
    a?: string
    min_p?: string
    max_p?: string
}

export const getRecommendedOrdersQuery = Joi.object({
    d: Joi.number().min(0).optional().description('最大配送距离，单位km'),
    t: Joi.number().integer().min(0).optional().description('最大配送时间，单位分钟'),
    lat: Joi.number().required().description('骑手当前位置纬度'),
    lon: Joi.number().required().description('骑手当前位置经度'),
    m: Joi.number().integer().min(0).optional().description('最小订单金额'),
    p: Joi.number().integer().min(0).default(0).optional().description('页码，从0开始'),
    pn: Joi.number().integer().min(1).max(100).default(10).optional().description('每页数量'),
}).required()

export interface GetRecommendedOrdersQuery {
    d?: number
    t?: number
    lat: number
    lon: number
    m?: number
    p: string
    pn: string
}