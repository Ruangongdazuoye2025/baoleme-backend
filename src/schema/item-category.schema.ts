import Joi from 'joi'

export const shopIdParams = Joi.object({
    shopId: Joi.string().uuid().required(),
}).required()

export interface ShopIdParams {
    shopId: string
}

export const shopIdCategoryIdParams = Joi.object({
    shopId: Joi.string().uuid().required(),
    categoryId: Joi.string().uuid().required(),
}).required()

export interface ShopIdCategoryIdParams {
    shopId: string
    categoryId: string
}

export const addUpdateItemCategory = Joi.object({
    name: Joi.string().required(),
}).required()

export interface AddUpdateItemCategory {
    name: string
}

export const updateItemCategoryPos = Joi.object({
    before: Joi.string().uuid().allow(null).required(),
}).required()

export interface UpdateItemCategoryPos {
    before: string | null
}