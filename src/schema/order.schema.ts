import Joi from 'joi'

export const getOrdersQuery = Joi.object({
    p: Joi.number().integer().min(1).default(1).optional(),
    pn: Joi.number().integer().min(1).max(100).default(10).optional(),
    s: Joi.string().valid('unpaid', 'preparing', 'prepared', 'delivering', 'finished', 'canceled').optional(),
}).required()

export interface GetOrdersQuery {
    p: string
    pn: string
    s?: 'unpaid' | 'preparing' | 'prepared' | 'delivering' | 'finished' | 'canceled'
}

export const getOrdersAsShopQuery = Joi.object({
    p: Joi.number().integer().min(1).default(1).optional(),
    pn: Joi.number().integer().min(1).max(100).default(10).optional(),
    s: Joi.string().valid('preparing', 'prepared', 'delivering', 'finished').optional(),
}).required()

export interface GetOrdersAsShopQuery {
    p: string
    pn: string
    s?: 'preparing' | 'prepared' | 'delivering' | 'finished'
}

export const createOrder = Joi.object({
    shopId: Joi.string().uuid().required(),
    addressId: Joi.string().uuid().required(),
    note: Joi.string().max(100).allow('').required(),
}).required()

export interface CreateOrder {
    shopId: string
    addressId: string
    note: string
}

export const orderIdParams = Joi.object({
    id: Joi.string().uuid().required(),
}).required()

export interface OrderIdParams {
    id: string
}

export const updateOrderStatus = Joi.object({
    status: Joi.string().valid('unpaid', 'preparing', 'prepared', 'delivering', 'finished', 'canceled').required(),
}).required()

export interface UpdateOrderStatus {
    status: 'unpaid' | 'preparing' | 'prepared' | 'delivering' | 'finished' | 'canceled'
}

export const shopIdParams = Joi.object({
    shopId: Joi.string().uuid().required(),
}).required()

export interface ShopIdParams {
    shopId: string
}