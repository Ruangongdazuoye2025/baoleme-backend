import Joi from 'joi';

const COORDINATE_SCHEMA = Joi.array().ordered(
    Joi.number().required(), // 经度 (longitude)
    Joi.number().required()  // 纬度 (latitude)
).length(2).required().messages({
    'array.length': '经纬度坐标必须包含两个数字',
    'any.required': '经纬度坐标为必填项',
});

export const createAddressSchema = Joi.object({
    province: Joi.string().min(1).required().messages({
        'string.empty': '省级行政区名不能为空', 'string.min': '省级行政区名不能为空', 'any.required': '省级行政区名为必填项',
    }),
    city: Joi.string().min(1).required().messages({
        'string.empty': '地级行政区名不能为空', 'string.min': '地级行政区名不能为空', 'any.required': '地级行政区名为必填项',
    }),
    district: Joi.string().min(1).required().messages({
        'string.empty': '县级行政区名不能为空', 'string.min': '县级行政区名不能为空', 'any.required': '县级行政区名为必填项',
    }),
    address: Joi.string().min(1).required().messages({
        'string.empty': '详细地址不能为空', 'string.min': '详细地址不能为空', 'any.required': '详细地址为必填项',
    }),
    name: Joi.string().min(1).required().messages({
        'string.empty': '联系人姓名不能为空', 'string.min': '联系人姓名不能为空', 'any.required': '联系人姓名为必填项',
    }),
    tel: Joi.string().pattern(/^[0-9]+$/).required().messages({
        'string.empty': '联系人电话不能为空', 'string.pattern.base': '联系人电话格式不正确，应全为数字', 'any.required': '联系人电话为必填项',
    }),
    coordinate: COORDINATE_SCHEMA,
    isDefault: Joi.boolean().required().messages({
        'any.required': '是否为默认地址为必填项',
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
        'string.pattern.base': '联系人电话格式不正确，应全为数字',
    }),
    coordinate: Joi.array().ordered(
        Joi.number().required(), Joi.number().required()
    ).length(2).optional().messages({
        'array.length': '经纬度坐标必须包含两个数字',
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
        'string.guid': '地址ID必须是有效的UUID格式',
        'any.required': '地址ID为必填项',
    }),
}).required();

export const updateAddressOrderSchema = Joi.object({
    before: Joi.string().uuid().allow(null).required().messages({
        'string.guid': 'before 参数必须是有效的UUID格式或null',
        'any.required': 'before 参数为必填项',
    })
}).required();

export interface UpdateAddressOrderDto {
    before: string | null;
}