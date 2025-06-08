import Joi from 'joi'

export const shopIdParams = Joi.object({
    id: Joi.string().uuid().required()
})

export interface ShopIdParams {
    id: string
}

export const shopIdAndItemIdParams = Joi.object({
    shopId: Joi.string().uuid().required(),
    itemId: Joi.string().uuid().required()
})

export interface ShopIdAndItemIdParams {
    shopId: string
    itemId: string
}

export const cartItemQuantityBody = Joi.object({
    quantity: Joi.number().integer().min(0).required()
})

export interface CartItemQuantityBody {
    quantity: number
}
