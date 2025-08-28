import { Context, ServiceSchema, Errors } from "moleculer";
import TokenMixin from "../mixins/token.mixin";
import { PrismaClient, Address, Prisma} from "@prisma/client";
import Joi from "joi";

const MAX_ADDRESSES_PER_USER = 16;

const COORDINATE_SCHEMA = Joi.array().ordered(
    Joi.number().required(), // 经度 (longitude)
    Joi.number().required()  // 纬度 (latitude)
).length(2).required().messages({
    'array.length': '经纬度坐标必须包含两个数字',
    'any.required': '经纬度坐标为必填项',
});

// Joi schemas
const createAddressSchema = Joi.object({
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


interface CreateAddressApiDto {
    province: string;
    city: string;
    district: string;
    address: string;
    name: string;
    tel: string;
    coordinate: [number, number];
    isDefault: boolean;
}

const updateAddressSchema = Joi.object({
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
    id: Joi.string().uuid().required(),
    isDefault: Joi.boolean().optional(),
}).min(1).required();

interface UpdateAddressApiDto {
    province?: string;
    city?: string;
    district?: string;
    address?: string;
    name?: string;
    tel?: string;
    coordinate?: [number, number];
    isDefault?: boolean;
}

const addressIdParamsSchema = Joi.object({
    id: Joi.string().uuid().required().messages({
        'string.guid': '地址ID必须是有效的UUID格式',
        'any.required': '地址ID为必填项',
    }),
}).required();

const updateAddressOrderSchema = Joi.object({
    id: Joi.string().uuid().required(),
    before: Joi.string().uuid().allow(null).required().messages({
        'string.guid': 'before 参数必须是有效的UUID格式或null',
        'any.required': 'before 参数为必填项',
    })
}).required();

interface UpdateAddressOrderDto {
    before: string | null;
}

interface ApiAddressResponse {
    id: string;
    coordinate: [number | null, number | null];
    province: string;
    city: string;
    district: string;
    address: string;
    name: string;
    tel: string;
    isDefault: boolean;
}

const AddressService: ServiceSchema = {
    name: "address",
    mixins: [TokenMixin],

    actions: {
        addAddress: {
            params: createAddressSchema as any,
            async handler(ctx: Context<CreateAddressApiDto, { currentUserId: string }>) {
                const userId = ctx.meta.currentUserId;
                const apiAddressData = ctx.params;
                const [longitude, latitude] = apiAddressData.coordinate;

                const newDbAddress = await (this.prisma as PrismaClient).$transaction(async (tx) => {
                    const currentAddresses = await tx.address.findMany({
                        where: { userId },
                        orderBy: { displayOrder: "asc" },
                    });

                    if (currentAddresses.length >= MAX_ADDRESSES_PER_USER) {
                        throw new Errors.MoleculerError(`一个用户最多只能拥有 ${MAX_ADDRESSES_PER_USER} 个收货地址`, 403);
                    }

                    if (currentAddresses.length === 0) {
                        apiAddressData.isDefault = true;
                    }

                    if (apiAddressData.isDefault) {
                        await tx.address.updateMany({
                            where: { userId: userId, isDefault: true },
                            data: { isDefault: false },
                        });
                    }

                    const targetdisplayOrder = currentAddresses.length;

                    const createdAddress = await tx.address.create({
                        data: {
                            userId,
                            recipientName: apiAddressData.name,
                            phoneNumber: apiAddressData.tel,
                            province: apiAddressData.province,
                            city: apiAddressData.city,
                            district: apiAddressData.district,
                            detail: apiAddressData.address,
                            longitude,
                            latitude,
                            isDefault: apiAddressData.isDefault,
                            displayOrder: targetdisplayOrder,
                        },
                    });
                    return createdAddress;
                });
                return this.mapDbAddressToApiResponse(newDbAddress);
            }
        },
        getAddresses: {
            // params: Joi.object({}).unknown(true), // no params, just meta
            async handler(ctx: Context<{}, { currentUserId: string }>) {
                const userId = ctx.meta.currentUserId;
                const dbAddresses = await (this.prisma as PrismaClient).address.findMany({
                    where: { userId },
                    orderBy: { displayOrder: "asc" },
                });
                return dbAddresses.map((addr: Address) => this.mapDbAddressToApiResponse(addr));
            }
        },
        getAddressById: {
            params: addressIdParamsSchema as any,
            async handler(ctx: Context<{ id: string }, { currentUserId: string }>) {
                const userId = ctx.meta.currentUserId;
                const { id: addressId } = ctx.params;
                const dbAddress = await (this.prisma as PrismaClient).address.findUnique({
                    where: { id: addressId },
                });

                if (!dbAddress) {
                    throw new Errors.MoleculerError("收货地址未找到", 404);
                }
                if (dbAddress.userId !== userId) {
                    throw new Errors.MoleculerError("无权查看此地址", 403);
                }
                return this.mapDbAddressToApiResponse(dbAddress);
            }
        },
        updateAddress: {
            params: updateAddressSchema as any,
            async handler(ctx: Context<UpdateAddressApiDto & { id: string }, { currentUserId: string }>) {
                const userId = ctx.meta.currentUserId;
                const { id: addressId, ...apiAddressData } = ctx.params;
                const dataToUpdate: Prisma.AddressUpdateInput = {
                    recipientName: apiAddressData.name,
                    phoneNumber: apiAddressData.tel,
                    province: apiAddressData.province,
                    city: apiAddressData.city,
                    district: apiAddressData.district,
                    detail: apiAddressData.address,
                    longitude: apiAddressData.coordinate?.[0],
                    latitude: apiAddressData.coordinate?.[1],
                    isDefault: apiAddressData.isDefault
                };

                const updatedDbAddress = await (this.prisma as PrismaClient).$transaction(async (tx) => {
                    const existingAddress = await tx.address.findUnique({ where: { id: addressId } });

                    if (!existingAddress) throw new Errors.MoleculerError("收货地址未找到", 404);
                    if (existingAddress.userId !== userId) throw new Errors.MoleculerError("无权修改此地址", 403);

                    if (typeof apiAddressData.isDefault === "boolean" && apiAddressData.isDefault) {
                        if (!existingAddress.isDefault || (Object.keys(dataToUpdate).length > 1)) {
                            await tx.address.updateMany({
                                where: { userId: userId, isDefault: true, NOT: { id: addressId } },
                                data: { isDefault: false },
                            });
                        }
                    }

                    return tx.address.update({ where: { id: addressId }, data: dataToUpdate });
                });
                return this.mapDbAddressToApiResponse(updatedDbAddress);
            }
        },
        updateAddressOrder: {
            params: updateAddressOrderSchema as any,
            async handler(ctx: Context<UpdateAddressOrderDto & { id: string }, { currentUserId: string }>) {
                const userId = ctx.meta.currentUserId;
                const { id: addressIdToMove, before } = ctx.params;

                await (this.prisma as PrismaClient).$transaction(async (tx) => {
                    const addressToMove = await tx.address.findUnique({
                        where: { id: addressIdToMove },
                    });

                    if (!addressToMove || addressToMove.userId !== userId) {
                        throw new Errors.MoleculerError("需要移动的地址未找到或不属于当前用户", 404);
                    }

                    if (before) {
                        const beforeAddress = await tx.address.findUnique({
                            where: { id: before },
                        });

                        if (!beforeAddress || beforeAddress.userId !== userId) {
                            throw new Errors.MoleculerError("目标位置 (before) 地址未找到或不属于当前用户", 404);
                        }

                        if (addressToMove.id === beforeAddress.id) {
                            return;
                        }

                        if (addressToMove.displayOrder < beforeAddress.displayOrder) {
                            await tx.address.updateMany({
                                where: {
                                    userId: userId,
                                    displayOrder: { gt: addressToMove.displayOrder, lt: beforeAddress.displayOrder },
                                },
                                data: { displayOrder: { decrement: 1 } },
                            });
                            await tx.address.update({
                                where: { id: addressIdToMove },
                                data: { displayOrder: beforeAddress.displayOrder - 1 },
                            });
                        } else {
                            await tx.address.updateMany({
                                where: {
                                    userId: userId,
                                    displayOrder: { gte: beforeAddress.displayOrder, lt: addressToMove.displayOrder },
                                },
                                data: { displayOrder: { increment: 1 } },
                            });
                            await tx.address.update({
                                where: { id: addressIdToMove },
                                data: { displayOrder: beforeAddress.displayOrder },
                            });
                        }
                    } else {
                        const maxOrderAgg = await tx.address.aggregate({
                            where: { userId: userId },
                            _max: { displayOrder: true },
                        });
                        const maxDisplayOrder = maxOrderAgg._max.displayOrder;

                        if (maxDisplayOrder === null) {
                            await tx.address.update({
                                where: { id: addressIdToMove },
                                data: { displayOrder: 0 },
                            });
                        } else {
                            await tx.address.updateMany({
                                where: {
                                    userId: userId,
                                    displayOrder: { gt: addressToMove.displayOrder },
                                },
                                data: { displayOrder: { decrement: 1 } },
                            });

                            await tx.address.update({
                                where: { id: addressIdToMove },
                                data: { displayOrder: maxDisplayOrder },
                            });
                        }
                    }
                });

                const updatedAddresses = await (this.prisma as PrismaClient).address.findMany({
                    where: { userId },
                    orderBy: { displayOrder: "asc" },
                });
                return updatedAddresses.map((addr: Address) => this.mapDbAddressToApiResponse(addr));
            }
        },
        deleteAddress: {
            params: addressIdParamsSchema as any,
            async handler(ctx: Context<{ id: string }, { currentUserId: string }>) {
                const userId = ctx.meta.currentUserId;
                const { id: addressId } = ctx.params;

                await (this.prisma as PrismaClient).$transaction(async (tx) => {
                    const addressToDelete = await tx.address.findUnique({ where: { id: addressId } });

                    if (!addressToDelete) throw new Errors.MoleculerError("收货地址未找到", 404);
                    if (addressToDelete.userId !== userId) throw new Errors.MoleculerError("无权删除此地址", 403);

                    await tx.address.delete({ where: { id: addressId } });

                    await this.reorderdisplayOrders(tx, userId);

                    if (addressToDelete.isDefault) {
                        const nextDefaultAddress = await tx.address.findFirst({
                            where: { userId },
                            orderBy: { displayOrder: "asc" },
                        });
                        if (nextDefaultAddress) {
                            await tx.address.update({
                                where: { id: nextDefaultAddress.id },
                                data: { isDefault: true },
                            });
                        }
                    }
                });
            }
        },
        setDefaultAddress: {
            params: addressIdParamsSchema as any,
            async handler(ctx: Context<{ id: string }, { currentUserId: string }>) {
                const userId = ctx.meta.currentUserId;
                const { id: addressId } = ctx.params;

                const updatedDbAddress = await (this.prisma as PrismaClient).$transaction(async (tx) => {
                    const addressToSetDefault = await tx.address.findUnique({ where: { id: addressId } });

                    if (!addressToSetDefault) throw new Errors.MoleculerError("收货地址未找到", 404);
                    if (addressToSetDefault.userId !== userId) throw new Errors.MoleculerError("无权操作此地址", 403);
                    if (addressToSetDefault.isDefault) return addressToSetDefault;

                    await tx.address.updateMany({
                        where: { userId: userId, isDefault: true },
                        data: { isDefault: false },
                    });
                    return tx.address.update({
                        where: { id: addressId },
                        data: { isDefault: true },
                    });
                });
                return this.mapDbAddressToApiResponse(updatedDbAddress);
            }
        }
    },

    methods: {
        mapDbAddressToApiResponse(dbAddress: Address): ApiAddressResponse {
            return {
                id: dbAddress.id,
                coordinate: [dbAddress.longitude, dbAddress.latitude],
                province: dbAddress.province,
                city: dbAddress.city,
                district: dbAddress.district,
                address: dbAddress.detail,
                name: dbAddress.recipientName,
                tel: dbAddress.phoneNumber,
                isDefault: dbAddress.isDefault,
            };
        },
        async reorderdisplayOrders(
            tx: Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">,
            userId: string
        ): Promise<void> {
            const addresses = await tx.address.findMany({
                where: { userId },
                orderBy: { displayOrder: "asc" },
            });
            for (let i = 0; i < addresses.length; i++) {
                if (addresses[i].displayOrder !== i) {
                    await tx.address.update({ where: { id: addresses[i].id }, data: { displayOrder: i } });
                }
            }
        }
    },

    created() {
        this.prisma = new PrismaClient();
    }
};

export default AddressService;
