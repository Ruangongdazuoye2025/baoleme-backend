import Joi from 'joi';

const COORDINATE_SCHEMA = Joi.array().ordered(
    Joi.number().required(), // longitude
    Joi.number().required()  // latitude
).length(2).required().messages({
    'array.length': 'Coordinates must contain two numbers',
    'any.required': 'Coordinates are required',
});

export const createAddressSchema = Joi.object({
    province: Joi.string().min(1).required().messages({
        'string.empty': 'Province name cannot be empty', 'string.min': 'Province name cannot be empty', 'any.required': 'Province name is required',
    }),
    city: Joi.string().min(1).required().messages({
        'string.empty': 'City name cannot be empty', 'string.min': 'City name cannot be empty', 'any.required': 'City name is required',
    }),
    district: Joi.string().min(1).required().messages({
        'string.empty': 'District name cannot be empty', 'string.min': 'District name cannot be empty', 'any.required': 'District name is required',
    }),
    address: Joi.string().min(1).required().messages({
        'string.empty': 'Detailed address cannot be empty', 'string.min': 'Detailed address cannot be empty', 'any.required': 'Detailed address is required',
    }),
    name: Joi.string().min(1).required().messages({
        'string.empty': 'Contact name cannot be empty', 'string.min': 'Contact name cannot be empty', 'any.required': 'Contact name is required',
    }),
    tel: Joi.string().pattern(/^[0-9]+$/).required().messages({
        'string.empty': 'Contact phone cannot be empty', 'string.pattern.base': 'Contact phone format is incorrect, should be all digits', 'any.required': 'Contact phone is required',
    }),
    coordinate: COORDINATE_SCHEMA,
    isDefault: Joi.boolean().required().messages({
        'any.required': 'Whether it is the default address is required',
    }),
}).required();

export interface CreateAddressApiDto {
    province: string;
    city: string;
    district: string;
    address: string;
    name: string;
    tel: string;
    coordinate: [number, number];
    isDefault: boolean;
}

export const updateAddressSchema = Joi.object({
    province: Joi.string().min(1).optional(),
    city: Joi.string().min(1).optional(),
    district: Joi.string().min(1).optional(),
    address: Joi.string().min(1).optional(),
    name: Joi.string().min(1).optional(),
    tel: Joi.string().pattern(/^[0-9]+$/).optional().messages({
        'string.pattern.base': 'Contact phone format is incorrect, should be all digits',
    }),
    coordinate: Joi.array().ordered(
        Joi.number().required(), Joi.number().required()
    ).length(2).optional().messages({
        'array.length': 'Coordinates must contain two numbers',
    }),
    isDefault: Joi.boolean().optional(),
}).min(1).required();

export interface UpdateAddressApiDto {
    province?: string;
    city?: string;
    district?: string;
    address?: string;
    name?: string;
    tel?: string;
    coordinate?: [number, number];
    isDefault?: boolean;
}

export const addressIdParamsSchema = Joi.object({
    id: Joi.string().uuid().required().messages({
        'string.guid': 'Address ID must be a valid UUID format',
        'any.required': 'Address ID is required',
    }),
}).required();

export const updateAddressOrderSchema = Joi.object({
    before: Joi.string().uuid().allow(null).required().messages({
        'string.guid': 'before parameter must be a valid UUID format or null',
        'any.required': 'before parameter is required',
    })
}).required();

export interface UpdateAddressOrderDto {
    before: string | null;
}