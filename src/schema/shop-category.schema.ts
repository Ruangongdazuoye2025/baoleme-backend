import Joi from 'joi'

export const addUpdateShopCategory = Joi.object({
    name: Joi.string().required(),
}).required()

export interface AddUpdateShopCategory {
    name: string
}

export const shopCategoryParams = Joi.object({
    id: Joi.string().uuid().required()
}).required()

export const updateShopCategoryPos = Joi.object({
    before: Joi.string().uuid().allow(null).required()
}).required()

export interface UpdateShopCategoryPos {
    before: string | null
}