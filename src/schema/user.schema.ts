import Joi from 'joi'

export const userProfileParams = Joi.object({
    id: Joi.string().uuid().required()
}).required()

export const updateUserProfile = Joi.object({
    name: Joi.string().allow('').optional(),
    description: Joi.string().allow('').optional(),
    role: Joi.string().valid('customer', 'rider', 'merchant', 'admin').optional(),
    emailVisible: Joi.boolean().optional(),
    createdAtVisible: Joi.boolean().optional(),
}).required()

export interface UpdateUserProfile {
    name?: string
    description?: string
    role?: 'customer' | 'rider' | 'merchant' | 'admin'
    emailVisible?: boolean
    createdAtVisible?: boolean
}
