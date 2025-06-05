import Joi from "joi";

export const createReview = Joi.object({
    order: Joi.string().required(),
    rating: Joi.number().integer().min(0).max(50).required(),
    content: Joi.string().required()
}).required();

export interface CreateReview {
    order: string;
    rating: number;
    content: string;
}

export const orderIdParams = Joi.object({
    id: Joi.string().required(),
}).required();

export interface OrderIdParams {
    id: string;
}

export const shopIdParams = Joi.object({
    id: Joi.string().required(),
}).required();

export interface ShopIdParams {
    id: string;
}

export const getReviewQuery = Joi.object({
    p: Joi.number().integer().min(0).default(0).optional(),
    pn: Joi.number().integer().min(1).max(100).default(10).optional(),
})

export interface GetReviewQuery {
    p: string;
    pn: string;
}

export const reviewIdParams = Joi.object({
    id: Joi.string().required(),
}).required();

export interface ReviewIdParams {
    id: string;
}

export const updateReview = Joi.object({
    rating: Joi.number().integer().min(0).max(50).required(),
    content: Joi.string().required(),
}).required();

export interface UpdateReview {
    rating: number;
    content: string;
}