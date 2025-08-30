import { Context, ServiceSchema, Errors } from "moleculer";
import { PrismaClient, Shop, ShopCategory, ItemCategory, Prisma, UserRole, User } from "@prisma/client";
import sharp from "sharp";
import Joi from "joi";
import { AuthMeta } from "../mixins/api-auth.mixin"; // 假设 AuthMeta 的路径
import { Readable } from 'stream';

// --- Joi Schemas for Request Validation ---

const getFilteredGlobalShopsRequestSchema = Joi.object({
    pageSkip: Joi.number().integer().min(0).default(0),
    pageLimit: Joi.number().integer().min(1).max(100).default(20),
    filterKeywords: Joi.array().items(Joi.string()).default([]),
    minCreatedAt: Joi.date().iso().optional(),
    maxCreatedAt: Joi.date().iso().optional(),
});

const getShopsByOwnerIdRequestSchema = Joi.object({
    ownerId: Joi.string().required(),
});

const shopIdRequestSchema = Joi.object({
    id: Joi.string().required(),
});

const createShopRequestSchema = Joi.object({
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
});

const updateShopProfileRequestSchema = Joi.object({
    id: Joi.string().required(),
    name: Joi.string().optional(),
    description: Joi.string().optional(),
    categories: Joi.array().items(Joi.string()).optional(),
    address: Joi.object({
        coordinate: Joi.array().items(Joi.number()).length(2).optional(),
        province: Joi.string().optional(),
        city: Joi.string().optional(),
        district: Joi.string().optional(),
        address: Joi.string().optional(),
        name: Joi.string().optional().allow(''),
        tel: Joi.string().optional().allow(''),
    }).optional(),
    verified: Joi.boolean().optional(),
    opened: Joi.boolean().optional(),
    openTimeStart: Joi.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
    openTimeEnd: Joi.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
    deliveryThreshold: Joi.number().min(0).optional(),
    deliveryPrice: Joi.number().min(0).optional(),
    maximumDistance: Joi.number().min(0).optional(),
});

// For updateShopImage, params come from ctx.meta.$params
const updateShopImageMetaParamsSchema = Joi.object({
    id: Joi.string().required(),
    fieldname: Joi.string().valid('cover', 'detail', 'license').required(), // 预期的文件字段名
});

const updateShopOwnerRequestSchema = Joi.object({
    id: Joi.string().required(),
    ownerId: Joi.string().required(),
});

const updateShopSaleRequestSchema = Joi.object({
    shopId: Joi.string().required(),
    saleCount: Joi.number().integer().min(0).required(),
});

const updateShopRatingRequestSchema = Joi.object({
    shopId: Joi.string().required(),
    rating: Joi.number().min(0).max(5).required(),
});

const addShopCategoryRequestSchema = Joi.object({
    name: Joi.string().required(),
});

const shopCategoryIdRequestSchema = Joi.object({
    id: Joi.string().required(),
});

const updateShopCategoryRequestSchema = Joi.object({
    id: Joi.string().required(),
    name: Joi.string().required(),
});

const updateShopCategoryPosRequestSchema = Joi.object({
    id: Joi.string().required(),
    before: Joi.string().optional(),
});

const getShopItemCategoriesRequestSchema = Joi.object({
    shopId: Joi.string().required(),
});

const addItemCategoryRequestSchema = Joi.object({
    shopId: Joi.string().required(),
    name: Joi.string().required(),
});

const getItemCategoryRequestSchema = Joi.object({
    shopId: Joi.string().required(),
    categoryId: Joi.string().required(),
});

const updateItemCategoryRequestSchema = Joi.object({
    shopId: Joi.string().required(),
    categoryId: Joi.string().required(),
    name: Joi.string().required(),
});

const updateItemCategoryPosRequestSchema = Joi.object({
    shopId: Joi.string().required(),
    categoryId: Joi.string().required(),
    before: Joi.string().optional(),
});

const deleteItemCategoryRequestSchema = Joi.object({
    shopId: Joi.string().required(),
    categoryId: Joi.string().required(),
});


// --- TypeScript Interfaces for Action Parameters ---

interface GetFilteredGlobalShopsRequest {
    pageSkip: number;
    pageLimit: number;
    filterKeywords: string[];
    minCreatedAt: Date;
    maxCreatedAt: Date;
}

interface GetShopsByOwnerIdRequest {
    ownerId: string;
}

interface GetShopRequest {
    id: string;
}

interface CreateShopRequest {
    name: string;
    description: string;
    categories: string[];
    address: {
        coordinate: [number, number];
        province: string;
        city: string;
        district: string;
        address: string;
        name: string;
        tel: string;
    };
    opened: boolean;
    openTimeStart: number;
    openTimeEnd: number;
    deliveryThreshold: number;
    deliveryPrice: number;
    maximumDistance: number;
}

interface UpdateShopProfileRequest {
    id: string;
    name: string;
    description: string;
    categories: string[];
    address: {
        coordinate: [number, number];
        province: string;
        city: string;
        district: string;
        address: string;
        name: string;
        tel: string;
    };
    verified?: boolean;
    opened: boolean;
    openTimeStart: string;
    openTimeEnd: string;
    deliveryThreshold: number;
    deliveryPrice: number;
    maximumDistance: number;
}

interface UpdateShopImageMeta { // For ctx.meta.$params in stream actions
    id: string;
    fieldname: 'cover' | 'detail' | 'license'; // 上传的文件类型
}

interface DeleteShopRequest {
    id: string;
}

interface UpdateShopOwnerRequest {
    id: string;
    ownerId: string;
}

interface AddShopCategoryRequest {
    name: string;
}

interface GetShopCategoryRequest {
    id: string;
}

interface UpdateShopCategoryRequest {
    id: string;
    name: string;
}

interface UpdateShopCategoryPosRequest {
    id: string;
    before: string;
}

interface DeleteShopCategoryRequest {
    id: string;
}

interface UpdateShopSaleRequest {
    shopId: string;
    saleCount: number;
}

interface UpdateShopRatingRequest {
    shopId: string;
    rating: number;
}

interface GetItemCategoriesRequest {
    shopId: string;
}

interface AddItemCategoryRequest {
    shopId: string;
    name: string;
}

interface GetItemCategoryRequest {
    shopId: string;
    categoryId: string;
}

interface UpdateItemCategoryRequest {
    shopId: string;
    categoryId: string;
    name: string;
}

interface UpdateItemCategoryPosRequest {
    shopId: string;
    categoryId: string;
    before: string;
}

interface DeleteItemCategoryRequest {
    shopId: string;
    categoryId: string;
}


// --- ShopService Definition ---

const ShopService: ServiceSchema = {
    name: "shop",

    actions: {
        getFilteredGlobalShops: {
            params: getFilteredGlobalShopsRequestSchema as any,
            async handler(ctx: Context<GetFilteredGlobalShopsRequest, AuthMeta>) {
                const { currentUserId, currentUserRole } = ctx.meta;
                const { pageSkip, pageLimit, filterKeywords, minCreatedAt, maxCreatedAt } = ctx.params;

                const currentUser = await ctx.call("user.get", { id: currentUserId });
                if (!currentUser) {
                    throw new Errors.MoleculerError('User not found', 404);
                }

                if (currentUserId !== currentUserId && currentUserRole !== UserRole.ADMIN) {
                    throw new Errors.MoleculerError('Permission denied', 401)
                }

                const whereConditions: Prisma.ShopWhereInput[] = [];
                if (filterKeywords && filterKeywords.length > 0) {
                    whereConditions.push({
                        OR: filterKeywords.map(keyword => ({
                            name: {
                                contains: keyword,
                                mode: 'insensitive' as Prisma.QueryMode
                            }
                        }))
                    });
                }
                if (minCreatedAt) {
                    whereConditions.push({ createdAt: { gte: minCreatedAt } });
                }
                if (maxCreatedAt) {
                    whereConditions.push({ createdAt: { lte: maxCreatedAt } });
                }

                const shops = await (this.prisma as PrismaClient).shop.findMany({
                    include: { categories: true },
                    where: { AND: whereConditions },
                    skip: pageSkip,
                    take: pageLimit,
                    orderBy: { createdAt: 'desc' },
                });
                return Promise.all(shops.map(shop => this.shopDataToFullShopInfo(shop, ctx)));
            }
        },

        getShopsByOwnerId: {
            params: getShopsByOwnerIdRequestSchema as any,
            async handler(ctx: Context<GetShopsByOwnerIdRequest>) {
                const { ownerId } = ctx.params;
                const user = await ctx.call("user.get", { id: ownerId });
                if (!user) {
                    throw new Errors.MoleculerError('User not found', 404);
                }

                const shops = await (this.prisma as PrismaClient).shop.findMany({
                    include: { categories: true },
                    where: { ownerId },
                    orderBy: { createdAt: 'desc' },
                });
                return Promise.all(shops.map(shop => this.shopDataToFullShopInfo(shop, ctx)));
            }
        },

        get: { 
            params: shopIdRequestSchema as any,
            async handler(ctx: Context<GetShopRequest>) {
                const { id } = ctx.params;

                const shop = await (this.prisma as PrismaClient).shop.findUnique({
                    where: { id },
                    include: { categories: true }
                });

                if (!shop) {
                    throw new Errors.MoleculerError('Shop not found', 404);
                }

                return this.shopDataToFullShopInfo(shop, ctx);
            }
        },

        createShop: {
            params: createShopRequestSchema as any,
            async handler(ctx: Context<CreateShopRequest, AuthMeta>) {
                const { currentUserId , currentUserRole } = ctx.meta;
                const { name, description, categories, address, opened, openTimeStart, openTimeEnd, deliveryThreshold, deliveryPrice, maximumDistance } = ctx.params;

                const user = await ctx.call("user.get", { id: currentUserId });
                if (!user) {
                    throw new Errors.MoleculerError('User not found', 404);
                }

                if (currentUserRole !== UserRole.MERCHANT && currentUserRole !== UserRole.ADMIN) {
                    throw new Errors.MoleculerError('Permission denied', 401);
                }

                await Promise.all(categories.map(async id => {
                    const category = await (this.prisma as PrismaClient).shopCategory.findUnique({ where: { id } });
                    if (!category) {
                        throw new Errors.MoleculerError(`Shop category '${id}' not found`, 404);
                    }
                }));

                const newShop = await (this.prisma as PrismaClient).shop.create({
                    data: {
                        name,
                        description,
                        ownerId: currentUserId, 
                        opened,
                        openTimeStart,
                        openTimeEnd,
                        deliveryThreshold,
                        deliveryPrice,
                        maximumDistance,
                        categories: { connect: categories.map(id => ({ id })) },
                        addressLongitude: address.coordinate[0],
                        addressLatitude: address.coordinate[1],
                        addressProvince: address.province,
                        addressCity: address.city,
                        addressDistrict: address.district,
                        addressAddress: address.address,
                        addressName: address.name,
                        addressTel: address.tel
                    },
                    include: { categories: true }
                });
                return this.shopDataToFullShopInfo(newShop, ctx);
            }
        },

        deleteShop: {
            params: shopIdRequestSchema as any,
            async handler(ctx: Context<DeleteShopRequest, AuthMeta>) {
                const { currentUserId, currentUserRole } = ctx.meta;
                const { id } = ctx.params;

                const shop = await (this.prisma as PrismaClient).shop.findUnique({ 
                    where: { id },
                    include: {
                        categories: {
                            select: { id: true }
                        }
                    }
                });
                if (!shop) {
                    throw new Errors.MoleculerError('Shop not found', 404);
                }

                const currentUser = await ctx.call("user.get", { id: currentUserId });
                if (!currentUser) {
                    throw new Errors.MoleculerError('User not found', 404);
                }

                if (currentUserId !== shop.ownerId && currentUserRole !== UserRole.ADMIN) {
                    throw new Errors.MoleculerError('Permission denied', 401);
                }

                await (this.prisma as PrismaClient).$transaction(async (tx) => {
                    await tx.itemCategory.deleteMany({
                        where: { shopId: id }
                    });
                    await tx.shop.delete({ where: { id } });
                });
                
                await Promise.all([
                    ctx.call("oss.removeObject", { objectName: `shops/${id}/cover.webp` }),
                    ctx.call("oss.removeObject", { objectName: `shops/${id}/cover-thumbnail.webp` }),
                    ctx.call("oss.removeObject", { objectName: `shops/${id}/detail.webp` }),
                    ctx.call("oss.removeObject", { objectName: `shops/${id}/detail-thumbnail.webp` }),
                    ctx.call("oss.removeObject", { objectName: `shops/${id}/license.webp` }),
                    ctx.call("oss.removeObject", { objectName: `shops/${id}/license-thumbnail.webp` }),
                ]);

                this.broker.emit("shop.deleted", {
                    id: id,
                    ownerId: shop.ownerId,
                    deletedBy: currentUserId,
                });
                return { success: true };
            }
        },

        updateShopProfile: {
            params: updateShopProfileRequestSchema as any,
            async handler(ctx: Context<UpdateShopProfileRequest, AuthMeta>) {
                const { currentUserId , currentUserRole } = ctx.meta;
                const { id, name, description, categories, address, opened, openTimeStart, openTimeEnd, deliveryThreshold, deliveryPrice, maximumDistance } = ctx.params;
                let { verified } = ctx.params;

                const shop = await (this.prisma as PrismaClient).shop.findUnique({ where: { id } });
                if (!shop) {
                    throw new Errors.MoleculerError('Shop not found', 404);
                }

                const currentUser = await ctx.call("user.get", { id: currentUserId });

                if (!currentUser) {
                    throw new Errors.MoleculerError('User not found', 404);
                }

                if (currentUserId !== shop.ownerId && currentUserRole !== UserRole.ADMIN) {
                    throw new Errors.MoleculerError('Permission denied', 401);
                }

                if (categories) {
                    await Promise.all(categories.map(async catId => {
                        const category = await (this.prisma as PrismaClient).shopCategory.findUnique({ where: { id: catId } });
                        if (!category) {
                            throw new Errors.MoleculerError(`Shop category '${catId}' not found`, 404);
                        }
                    }));
                }

                if(currentUserRole !== UserRole.ADMIN) {
                    verified = undefined;
                }

                const updatedShop = await (this.prisma as PrismaClient).shop.update({
                    where: { id },
                    data: {
                        name,
                        description,
                        categories: categories ? { set: categories.map(catId => ({ id: catId })) } : undefined,
                        addressLongitude: address?.coordinate?.[0],
                        addressLatitude: address?.coordinate?.[1],
                        addressProvince: address?.province,
                        addressCity: address?.city,
                        addressDistrict: address?.district,
                        addressAddress: address?.address,
                        addressName: address?.name,
                        addressTel: address?.tel,
                        verified,
                        opened,
                        openTimeStart: openTimeStart ? this.timeToMinutes(openTimeStart) : null,
                        openTimeEnd: openTimeEnd ? this.timeToMinutes(openTimeEnd) : null,
                        deliveryThreshold,
                        deliveryPrice,
                        maximumDistance
                    },
                    include: { categories: true }
                });
                return this.shopDataToFullShopInfo(updatedShop, ctx);
            }
        },

        updateShopImage: {
            params: updateShopImageMetaParamsSchema as any,
            async handler(ctx: Context<any, AuthMeta & { $params: UpdateShopImageMeta } & { mimetype: string }>) {
                const stream = ctx.params; 
                const { currentUserId, currentUserRole } = ctx.meta;
                const { id } = ctx.meta.$params; 
                const { mimetype, fieldname } = ctx.meta as any; 

                if (!mimetype.startsWith('image/')) {
                    throw new Errors.MoleculerError("Invalid image format", 400);
                }

                const shop = await (this.prisma as PrismaClient).shop.findUnique({ where: { id } });
                if (!shop) {
                    throw new Errors.MoleculerError('Shop not found', 404);
                }

                if (currentUserId !== shop.ownerId && currentUserRole !== UserRole.ADMIN) {
                    throw new Errors.MoleculerError('Permission denied', 401, 'FORBIDDEN');
                }

                const chunks: Buffer[] = [];
                for await (const chunk of stream as Readable) {
                    chunks.push(chunk);
                }
                const buffer = Buffer.concat(chunks);

                const objectNameBase = `shops/${id}/${fieldname}`;

                const [originUrl, thumbnailUrl] = await Promise.all([
                    ctx.call("oss.putObject", {
                        objectName: `${objectNameBase}.webp`,
                        content: sharp(buffer).toFormat('webp'), 
                        contentType: 'image/webp'
                    }),
                    ctx.call("oss.putObject", {
                        objectName: `${objectNameBase}-thumbnail.webp`,
                        content: sharp(buffer).resize(128, 128, { fit: 'outside' }).toFormat('webp'),
                        contentType: 'image/webp'
                    })
                ]);

                return { fieldname, origin: originUrl, thumbnail: thumbnailUrl };
            }
        },

        updateShopOwner: {
            params: updateShopOwnerRequestSchema as any,
            async handler(ctx: Context<UpdateShopOwnerRequest, AuthMeta>) {
                const { currentUserId, currentUserRole } = ctx.meta;
                const { id, ownerId } = ctx.params;

                const shop = await (this.prisma as PrismaClient).shop.findUnique({ where: { id } });
                if (!shop) {
                    throw new Errors.MoleculerError('Shop not found', 404);
                }

                const currentUser = await ctx.call("user.getRole", { id: currentUserId });
                if (!currentUser) {
                    throw new Errors.MoleculerError('User not found', 404);
                }

                if (currentUserRole !== UserRole.ADMIN && currentUserId !== shop.ownerId) {
                    throw new Errors.MoleculerError('Permission denied', 401);
                }

                const newOwner = await ctx.call("user.get", { id: ownerId });
                if (!newOwner) {
                    throw new Errors.MoleculerError('New owner user not found', 404);
                }

                await (this.prisma as PrismaClient).shop.update({
                    where: { id },
                    data: { ownerId }
                });
                return { success: true, newOwnerId: ownerId };
            }
        },


        updateShopSale: {
            params: updateShopSaleRequestSchema as any,
            async handler(ctx: Context<UpdateShopSaleRequest>) {
                const { shopId, saleCount } = ctx.params;

                const shop = await (this.prisma as PrismaClient).shop.update({
                    where: { id: shopId },
                    data: { sale: saleCount }
                });
                return shop;
            }
        },

        updateShopRating: {
            params: updateShopRatingRequestSchema as any,
            async handler(ctx: Context<UpdateShopRatingRequest>) {
                const { shopId, rating } = ctx.params;

                const shop = await (this.prisma as PrismaClient).shop.update({
                    where: { id: shopId },
                    data: { rating }
                });
                return shop;
            }
        },

        getShopImageLinks: {
            params: shopIdRequestSchema as any,
            async handler(ctx: Context<GetShopRequest>) {
                const { id } = ctx.params;
                const [coverOrigin, coverThumbnail, detailOrigin, detailThumbnail, licenseOrigin, licenseThumbnail] = await Promise.all([
                    ctx.call("oss.getObjectUrl", { objectName: `shops/${id}/cover.webp` }),
                    ctx.call("oss.getObjectUrl", { objectName: `shops/${id}/cover-thumbnail.webp` }),
                    ctx.call("oss.getObjectUrl", { objectName: `shops/${id}/detail.webp` }),
                    ctx.call("oss.getObjectUrl", { objectName: `shops/${id}/detail-thumbnail.webp` }),
                    ctx.call("oss.getObjectUrl", { objectName: `shops/${id}/license.webp` }),
                    ctx.call("oss.getObjectUrl", { objectName: `shops/${id}/license-thumbnail.webp` }),
                ]);
                return {
                    cover: { origin: coverOrigin, thumbnail: coverThumbnail },
                    detailImage: { origin: detailOrigin, thumbnail: detailThumbnail },
                    license: { origin: licenseOrigin, thumbnail: licenseThumbnail }
                };
            }
        },

        getShopCategories: {
            async handler(ctx: Context<{}, AuthMeta>) {
                return await (this.prisma as PrismaClient).shopCategory.findMany({
                    orderBy: { order: 'asc' }
                });
            }
        },

        addShopCategory: {
            params: addShopCategoryRequestSchema as any,
            async handler(ctx: Context<AddShopCategoryRequest, AuthMeta>) {
                const { currentUserId, currentUserRole } = ctx.meta;
                const { name } = ctx.params;

                const currentUser = await ctx.call("user.getRole", { id: currentUserId });
                if(!currentUser) {
                    throw new Errors.MoleculerError('User not found', 404);
                }
                if(currentUserId !== currentUserId && currentUserRole !== UserRole.ADMIN) {
                    throw new Errors.MoleculerError('Permission denied', 401);
                }

                const maxOrder = (await (this.prisma as PrismaClient).shopCategory.aggregate({
                    _max: { order: true }
                }))._max.order ?? -1;

                const newCategory = await (this.prisma as PrismaClient).shopCategory.create({
                    data: {
                        name,
                        order: maxOrder + 1
                    }
                });
                return newCategory;
            }
        },

        getShopCategory: {
            params: shopCategoryIdRequestSchema as any,
            async handler(ctx: Context<GetShopCategoryRequest, AuthMeta>) {
                const { id } = ctx.params;
                const category = await (this.prisma as PrismaClient).shopCategory.findUnique({
                    where: { id }
                });
                if (!category) {
                    throw new Errors.MoleculerError('Shop category not found', 404);
                }
                return category;
            }
        },

        updateShopCategory: {
            params: updateShopCategoryRequestSchema as any,
            async handler(ctx: Context<UpdateShopCategoryRequest, AuthMeta>) {
                const { currentUserId, currentUserRole } = ctx.meta;
                const { id, name } = ctx.params;

                const currentUser = await ctx.call("user.getRole", { id: currentUserId });
                if (!currentUser) {
                    throw new Errors.MoleculerError('User not found', 404);
                }
                if (currentUserId !== currentUserId && currentUserRole !== UserRole.ADMIN) {
                    throw new Errors.MoleculerError('Permission denied', 401);
                }

                const category = await (this.prisma as PrismaClient).shopCategory.findUnique({ where: { id } });
                if (!category) {
                    throw new Errors.MoleculerError('Shop category not found', 404);
                }

                const updatedCategory = await (this.prisma as PrismaClient).shopCategory.update({
                    where: { id },
                    data: { name }
                });
                return updatedCategory;
            }
        },

        updateShopCategoryPos: {
            params: updateShopCategoryPosRequestSchema as any,
            async handler(ctx: Context<UpdateShopCategoryPosRequest, AuthMeta>) {
                const { currentUserId, currentUserRole } = ctx.meta;
                const { id, before } = ctx.params;

                const currentUser = await ctx.call("user.getRole", { id: currentUserId });
                if (!currentUser) {
                    throw new Errors.MoleculerError('User not found', 404);
                }
                if (currentUserId !== currentUserId && currentUserRole !== UserRole.ADMIN) {
                    throw new Errors.MoleculerError('Permission denied', 401);
                }

                const category = await (this.prisma as PrismaClient).shopCategory.findUnique({ where: { id } });
                if (!category) {
                    throw new Errors.MoleculerError('Shop category not found', 404);
                }

                await (this.prisma as PrismaClient).$transaction(async tx => {
                    if (before) {
                        const beforeCategory = await tx.shopCategory.findUnique({ where: { id: before } });
                        if (!beforeCategory) {
                            throw new Errors.MoleculerError('Target shop category for position not found', 404);
                        }

                        if (category.order === beforeCategory.order) {
                            return;
                        }

                        if (category.order < beforeCategory.order) {
                            await tx.shopCategory.updateMany({
                                where: {
                                    order: { gt: category.order, lt: beforeCategory.order }
                                },
                                data: { order: { decrement: 1 } }
                            });
                            await tx.shopCategory.update({
                                where: { id },
                                data: { order: beforeCategory.order - 1 }
                            });
                        } else {
                            await tx.shopCategory.updateMany({
                                where: {
                                    order: { lt: category.order, gte: beforeCategory.order }
                                },
                                data: { order: { increment: 1 } }
                            });
                            await tx.shopCategory.update({
                                where: { id },
                                data: { order: beforeCategory.order }
                            });
                        }
                    } else {
                        const maxOrder = (await tx.shopCategory.aggregate({
                            _max: { order: true }
                        }))._max.order!;
                        if (category.order === maxOrder) {
                            return;
                        }
                        await tx.shopCategory.updateMany({
                            where: {
                                order: { gt: category.order }
                            },
                            data: { order: { decrement: 1 } }
                        });
                        await tx.shopCategory.update({
                            where: { id },
                            data: { order: maxOrder }
                        });
                    }
                });
                return { success: true };
            }
        },

        deleteShopCategory: {
            params: shopCategoryIdRequestSchema as any,
            async handler(ctx: Context<DeleteShopCategoryRequest, AuthMeta>) {
                const { currentUserId, currentUserRole } = ctx.meta;
                const { id } = ctx.params;

                const currentUser = await ctx.call("user.getRole", { id: currentUserId });
                if (!currentUser) {
                    throw new Errors.MoleculerError('User not found', 404);
                }
                if (currentUserId !== currentUserId && currentUserRole !== UserRole.ADMIN) {
                    throw new Errors.MoleculerError('Permission denied', 401);
                }

                const category = await (this.prisma as PrismaClient).shopCategory.findUnique({ 
                    where: { id },
                    include: {
                        shops: {
                            select: { id: true }
                        }
                    }
                });
                if (!category) {
                    throw new Errors.MoleculerError('Shop category not found', 404);
                }
                
                await (this.prisma as PrismaClient).shopCategory.delete({
                    where: { id }
                });
                this.broker.emit("shopCategory.deleted", {
                    id: id,
                    affectedShopIds: category.shops.map(shop => shop.id),
                    deletedBy: currentUserId,
                });
                return { success: true };
            }
        },

        getItemCategories: {
            params: getShopItemCategoriesRequestSchema as any,
            async handler(ctx: Context<GetItemCategoriesRequest>) {
                const { shopId } = ctx.params;

                const shop = await (this.prisma as PrismaClient).shop.findUnique({ where: { id: shopId } });
                if (!shop) {
                    throw new Errors.MoleculerError('Shop not found', 404);
                }

                const itemCategories = await (this.prisma as PrismaClient).itemCategory.findMany({
                    where: { shopId },
                    orderBy: { order: 'asc' },
                });
                return itemCategories.map(cat => this.itemCategoryDataToItemCategoryInfo(cat));
            }
        },


        addItemCategory: {
            params: addItemCategoryRequestSchema as any,
            async handler(ctx: Context<AddItemCategoryRequest, AuthMeta>) {
                const { currentUserId, currentUserRole } = ctx.meta;
                const { shopId, name } = ctx.params;

                const shop = await (this.prisma as PrismaClient).shop.findUnique({ where: { id: shopId } });
                if (!shop) {
                    throw new Errors.MoleculerError('Shop not found', 404);
                }

                const currentUser = await ctx.call("user.getRole", { id: currentUserId });
                if (!currentUser) {
                    throw new Errors.MoleculerError('User not found', 404);
                }
                if (currentUserId !== shop.ownerId && currentUserRole !== UserRole.ADMIN) {
                    throw new Errors.MoleculerError('Permission denied', 401);
                }

                const maxOrder = (await (this.prisma as PrismaClient).itemCategory.aggregate({
                    where: { shopId },
                    _max: { order: true },
                }))._max.order ?? -1;

                const newCategory = await (this.prisma as PrismaClient).itemCategory.create({
                    data: {
                        name,
                        shopId,
                        order: maxOrder + 1,
                    },
                });
                return this.itemCategoryDataToItemCategoryInfo(newCategory);
            }
        },

        getItemCategory: {
            params: getItemCategoryRequestSchema as any,
            async handler(ctx: Context<GetItemCategoryRequest>) {
                const { shopId, categoryId } = ctx.params;

                const shop = await (this.prisma as PrismaClient).shop.findUnique({ where: { id: shopId } });
                if (!shop) {
                    throw new Errors.MoleculerError('Shop not found', 404);
                }

                const category = await (this.prisma as PrismaClient).itemCategory.findUnique({
                    where: {
                        id: categoryId,
                        shopId: shopId,
                    },
                });
                if (!category) {
                    throw new Errors.MoleculerError('Item category not found', 404);
                }
                return this.itemCategoryDataToItemCategoryInfo(category);
            }
        },

        updateItemCategory: {
            params: updateItemCategoryRequestSchema as any,
            async handler(ctx: Context<UpdateItemCategoryRequest, AuthMeta>) {
                const { currentUserId, currentUserRole } = ctx.meta;
                const { shopId, categoryId, name } = ctx.params;

                const shop = await (this.prisma as PrismaClient).shop.findUnique({ where: { id: shopId } });
                if (!shop) {
                    throw new Errors.MoleculerError('Shop not found', 404);
                }

                const currentUser = await ctx.call("user.getRole", { id: currentUserId });
                if (!currentUser) {
                    throw new Errors.MoleculerError('User not found', 404);
                }
                if (currentUserId !== shop.ownerId && currentUserRole !== UserRole.ADMIN) {
                    throw new Errors.MoleculerError('Permission denied', 401);
                }

                const category = await (this.prisma as PrismaClient).itemCategory.findUnique({
                    where: {
                        id: categoryId,
                        shopId: shopId,
                    },
                });
                if (!category) {
                    throw new Errors.MoleculerError('Item category not found', 404);
                }

                const updatedCategory = await (this.prisma as PrismaClient).itemCategory.update({
                    where: { id: categoryId },
                    data: { name },
                });
                return this.itemCategoryDataToItemCategoryInfo(updatedCategory);
            }
        },

        updateItemCategoryPos: {
            params: updateItemCategoryPosRequestSchema as any,
            async handler(ctx: Context<UpdateItemCategoryPosRequest, AuthMeta>) {
                const { currentUserId, currentUserRole } = ctx.meta;
                const { shopId, categoryId, before } = ctx.params;

                const shop = await (this.prisma as PrismaClient).shop.findUnique({ where: { id: shopId } });
                if (!shop) {
                    throw new Errors.MoleculerError('Shop not found', 404);
                }

                const currentUser = await ctx.call("user.getRole", { id: currentUserId });
                if (!currentUser) {
                    throw new Errors.MoleculerError('User not found', 404);
                }
                if (currentUserId !== shop.ownerId && currentUserRole !== UserRole.ADMIN) {
                    throw new Errors.MoleculerError('Permission denied', 401);
                }

                const category = await (this.prisma as PrismaClient).itemCategory.findUnique({
                    where: {
                        id: categoryId,
                        shopId: shopId,
                    }
                });
                if (!category) {
                    throw new Errors.MoleculerError('Item category not found', 404);
                }

                await (this.prisma as PrismaClient).$transaction(async tx => {
                    if (before) {
                        const beforeCategory = await tx.itemCategory.findUnique({ where: { id: before } });
                        if (!beforeCategory || beforeCategory.shopId !== shopId) {
                            throw new Errors.MoleculerError('Target item category for position not found', 404);
                        }

                        if (category.order === beforeCategory.order) {
                            return;
                        }

                        if (category.order < beforeCategory.order) {
                            await tx.itemCategory.updateMany({
                                where: {
                                    shopId,
                                    order: { gt: category.order, lt: beforeCategory.order }
                                },
                                data: { order: { decrement: 1 } }
                            });
                            await tx.itemCategory.update({
                                where: { id: categoryId },
                                data: { order: beforeCategory.order - 1 }
                            });
                        } else {
                            await tx.itemCategory.updateMany({
                                where: {
                                    shopId,
                                    order: { lt: category.order, gte: beforeCategory.order }
                                },
                                data: { order: { increment: 1 } }
                            });
                            await tx.itemCategory.update({
                                where: { id: categoryId },
                                data: { order: beforeCategory.order }
                            });
                        }
                    } else {
                        const maxOrder = (await tx.itemCategory.aggregate({
                            where: { shopId },
                            _max: { order: true }
                        }))._max.order!;
                        if (category.order === maxOrder) {
                            return; 
                        }
                        await tx.itemCategory.updateMany({
                            where: {
                                shopId,
                                order: { gt: category.order }
                            },
                            data: { order: { decrement: 1 } }
                        });
                        await tx.itemCategory.update({
                            where: { id: categoryId },
                            data: { order: maxOrder }
                        });
                    }
                });
                return { success: true };
            }
        },

        deleteItemCategory: {
            params: deleteItemCategoryRequestSchema as any,
            async handler(ctx: Context<DeleteItemCategoryRequest, AuthMeta>) {
                const { currentUserId, currentUserRole } = ctx.meta;
                const { shopId, categoryId } = ctx.params;

                const shop = await (this.prisma as PrismaClient).shop.findUnique({ where: { id: shopId } });
                if (!shop) {
                    throw new Errors.MoleculerError('Shop not found', 404);
                }

                const currentUser = await ctx.call("user.getRole", { id: currentUserId });
                if (!currentUser) {
                    throw new Errors.MoleculerError('User not found', 404);
                }
                if (currentUserId !== shop.ownerId && currentUserRole !== UserRole.ADMIN) {
                    throw new Errors.MoleculerError('Permission denied', 401);
                }

                const category = await (this.prisma as PrismaClient).itemCategory.findUnique({
                    where: {
                        id: categoryId,
                        shopId: shopId,
                    },
                });
                if (!category) {
                    throw new Errors.MoleculerError('Item category not found', 404);
                }

                await (this.prisma as PrismaClient).itemCategory.delete({
                    where: { id: categoryId },
                });
                this.broker.emit("itemCategory.deleted", {
                    id: categoryId,
                    shopId: shopId,
                    deletedBy: currentUserId,
                });
                return { success: true };
            }
        }
    },

    methods: {
        shopCategoryDataToShopCategoryInfo(category: ShopCategory) {
            return {
                id: category.id,
                name: category.name,
            };
        },
        timeToMinutes(time: string): number {
            const [hours, minutes] = time.split(':').map(Number);
            return hours * 60 + minutes;
        },

        itemCategoryDataToItemCategoryInfo(category: ItemCategory) {
            return {
                id: category.id,
                name: category.name,
            };
        },

        async shopDataToFullShopInfo(shop: Prisma.ShopGetPayload<{ include: { categories: true } }>, ctx: Context) {
            return {
                id: shop.id,
                owner: shop.ownerId,
                createdAt: shop.createdAt,
                ...this.shopDataToShopProfile(shop),
                ...(await ctx.call("shop.getShopImageLinks", { id: shop.id }) as any),
                rating: shop.rating,
                sale: shop.sale,
                averagePrice: shop.averagePrice,
            };
        },

        shopDataToShopProfile(shop: Prisma.ShopGetPayload<{ include: { categories: true } }>) {
            return {
                name: shop.name,
                description: shop.description,
                categories: shop.categories.map(category => category.id),
                address: {
                    coordinate: [shop.addressLongitude, shop.addressLatitude],
                    province: shop.addressProvince,
                    city: shop.addressCity,
                    district: shop.addressDistrict,
                    address: shop.addressAddress,
                    name: shop.addressName,
                    tel: shop.addressTel,
                },
                verified: shop.verified,
                opened: shop.opened,
                openTimeStart: shop.openTimeStart,
                openTimeEnd: shop.openTimeEnd,
                deliveryThreshold: shop.deliveryThreshold,
                deliveryPrice: shop.deliveryPrice,
                maximumDistance: shop.maximumDistance,
            };
        },
    },

    async created() {
        this.prisma = new PrismaClient();
    },

    async stopped() {
        await (this.prisma as PrismaClient).$disconnect();
    }
};

export default ShopService;
