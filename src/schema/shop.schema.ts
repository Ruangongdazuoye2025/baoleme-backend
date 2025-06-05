import Joi from 'joi'

export const getShopsQuery = Joi.object({
    p: Joi.number().integer().min(0).default(0).optional(),
    pn: Joi.number().integer().min(1).max(100).default(10).optional(),
    q: Joi.string().allow('').default('').optional(),
    min_ca: Joi.string().isoDate().optional(),
    max_ca: Joi.string().isoDate().optional(),
}).required()

export interface GetShopsQuery {
    p: string
    pn: string
    q: string
    min_ca?: string
    max_ca?: string
}

export const createShop = Joi.object({
    name: Joi.string().required(),
    description: Joi.string().allow('').required(),
    categories: Joi.array().items(Joi.string()).required(),
    address: Joi.object({
        coordinate: Joi.array().items(Joi.number()).length(2).required(),
        province: Joi.string().required(),
        city: Joi.string().required(),
        district: Joi.string().required(),
        address: Joi.string().required(),
        name: Joi.string().required(),
        tel: Joi.string().required(),
    }).required(),
    opened: Joi.boolean().required(),
    openTimeStart: Joi.number().integer().min(0).max(1440).required(),
    openTimeEnd: Joi.number().integer().min(0).max(1440).required(),
    deliveryThreshold: Joi.number().integer().min(0).required(),
    deliveryPrice: Joi.number().integer().min(0).required(),
    maximumDistance: Joi.number().min(0).required(),
})

export interface CreateShop {
    name: string
    description: string
    categories: string[]
    address: {
        coordinate: [number, number]
        province: string
        city: string
        district: string
        address: string
        name: string
        tel: string
    }
    opened: boolean
    openTimeStart: number
    openTimeEnd: number
    deliveryThreshold: number
    deliveryPrice: number
    maximumDistance: number
}

export const shopIdParams = Joi.object({
    id: Joi.string().uuid().required(),
}).required()

export const updateShopProfile = Joi.object({
    name: Joi.string().optional(),
    description: Joi.string().allow('').optional(),
    categories: Joi.array().items(Joi.string()).optional(),
    address: Joi.object({
        coordinate: Joi.array().items(Joi.number()).length(2).optional(),
        province: Joi.string().optional(),
        city: Joi.string().optional(),
        district: Joi.string().optional(),
        address: Joi.string().optional(),
        name: Joi.string().optional(),
        tel: Joi.string().optional(),
    }).optional(),
    verified: Joi.boolean().optional(),
    opened: Joi.boolean().optional(),
    openTimeStart: Joi.number().integer().min(0).max(1440).optional(),
    openTimeEnd: Joi.number().integer().min(0).max(1440).optional(),
    deliveryThreshold: Joi.number().integer().min(0).optional(),
    deliveryPrice: Joi.number().integer().min(0).optional(),
    maximumDistance: Joi.number().min(0).optional(),
})

export interface UpdateShopProfile {
    name?: string
    description?: string
    categories?: string[]
    address?: {
        coordinate?: [number, number]
        province?: string
        city?: string
        district?: string
        address?: string
        name?: string
        tel?: string
    }
    verified?: boolean
    opened?: boolean
    openTimeStart?: number
    openTimeEnd?: number
    deliveryThreshold?: number
    deliveryPrice?: number
    maximumDistance?: number
}

export const updateShopOwner = Joi.object({
    owner: Joi.string().uuid().required(),
}).required()

export interface UpdateShopOwner {
    owner: string
}
