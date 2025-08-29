import { Context, ServiceSchema, Errors } from "moleculer";
import { PrismaClient, Item, ItemCategory, Prisma,User,UserRole } from "@prisma/client";
import sharp from "sharp";
import Joi from "joi";
import { AuthMeta } from "../mixins/api-auth.mixin";
import { Readable } from 'stream';
// Schema definitions
const getItemsRequestSchema = Joi.object({
    shopId: Joi.string().required(),
    pageSkip: Joi.number().integer().min(0).default(0),
    pageLimit: Joi.number().integer().min(1).max(100).default(20)
});

const getShopCategoryItemsRequestSchema = Joi.object({
    shopId: Joi.string().required(),
    categoryId: Joi.string().required(),
    pageSkip: Joi.number().integer().min(0).default(0),
    pageLimit: Joi.number().integer().min(1).max(100).default(20)
});

const getItemRequestSchema = Joi.object({
    id: Joi.string().required()
});

const createItemRequestSchema = Joi.object({
    shopId: Joi.string().required(),
    name: Joi.string().required(),
    description: Joi.string().optional(),
    available: Joi.boolean().default(true),
    stockout: Joi.boolean().default(false),
    price: Joi.number().min(0).required(),
    priceWithoutPromotion: Joi.number().min(0).optional(),
    categories: Joi.array().items(Joi.string()).default([])
});

const updateItemProfileRequestSchema = Joi.object({
    id: Joi.string().required(),
    name: Joi.string().optional(),
    description: Joi.string().optional(),
    available: Joi.boolean().optional(),
    stockout: Joi.boolean().optional(),
    price: Joi.number().min(0).optional(),
    priceWithoutPromotion: Joi.number().min(0).optional(),
    categories: Joi.array().items(Joi.string()).optional()
});

const updateItemImageRequestSchema = Joi.object({
    id: Joi.string().required(),
    cover: Joi.binary().optional()
});

const deleteItemRequestSchema = Joi.object({
    id: Joi.string().required()
});

const updateItemSaleRequestSchema = Joi.object({
    itemId: Joi.string().required(),
    saleCount: Joi.number().integer().min(0).required()
});

const updateItemRatingRequestSchema = Joi.object({
    itemId: Joi.string().required(),
    rating: Joi.number().min(0).max(5).required()
});

const getShopItemIdsRequestSchema = Joi.object({
    shopId: Joi.string().required()
});

interface GetItemsRequest {
    shopId: string;
    pageSkip: number;
    pageLimit: number;
}

interface GetShopCategoryItemsRequest {
    shopId: string;
    categoryId: string;
    pageSkip: number;
    pageLimit: number;
}

interface GetItemRequest {
    id: string;
}

interface CreateItemRequest {
    shopId: string;
    name: string;
    description: string;
    available: boolean;
    stockout: boolean;
    price: number;
    priceWithoutPromotion: number;
    categories: string[]; // Category ids
}

interface UpdateItemProfileRequest  {
    id: string;
    name?: string;
    description?: string;
    available?: boolean;
    stockout?: boolean;
    price?: number;
    priceWithoutPromotion?: number;
    categories?: string[]; // Category ids
}

interface UpdateItemImageRequest {
    id: string;
    cover?: Buffer;
}

interface DeleteItemRequest {
    id: string;
}

interface UpdateItemSaleRequest {
    itemId: string;
    saleCount: number;
}

interface UpdateItemRatingRequest {
    itemId: string;
    rating: number;
}

interface GetShopItemIdsRequest {
    shopId: string;
}

const ItemService: ServiceSchema = {
    name: "item",

    events: {
        'shop.deleted':{
            async handler(ctx: Context<{ id: string}>) {
                const shopId = ctx.params.id;
                const items = await (this.prisma as PrismaClient).item.findMany({
                    where: { shopId },
                    select: { id: true }
                });
                for (const item of items) {
                    await ctx.call("item.deleteItem", { id: item.id }
                    );
                }
            }
        },
        'itemCategory.deleted':{
            async handler(ctx: Context<{ id: string, shopId: string }>) {
                const { id: categoryId } = ctx.params;
                await (this.prisma as PrismaClient).itemItemCategory.deleteMany({
                    where: { categoryId }
                });
            }
        }
    },
    actions: {
        // Get items for a shop
        getItems: {
            params: getItemsRequestSchema as any,
            async handler(ctx: Context<GetItemsRequest, { currentUserId: string }>) {
                const { currentUserId } = ctx.meta ;
                const { shopId, pageSkip, pageLimit } = ctx.params;

                const user = await ctx.call("user.get", { id: currentUserId });
                if (!user) {
                    throw new Errors.MoleculerError('Unauthorized', 401);
                }

                const items = await (this.prisma as PrismaClient).item.findMany({
                    where: { shopId },
                    skip: pageSkip,
                    take: pageLimit,
                    orderBy: { createdAt: 'desc' }
                });

                return Promise.all(items.map(item => this.itemDataToFullItemInfo(item)));
            }
        },

        // Get items by category for a shop
        getShopCategoryItems: {
            params: getShopCategoryItemsRequestSchema as any,
            async handler(ctx: Context<GetShopCategoryItemsRequest, { currentUserId: string }>) {
                const { currentUserId } = ctx.meta;
                const { shopId, categoryId, pageSkip, pageLimit } = ctx.params;

                const user = await ctx.call("user.get", { id: currentUserId });
                if (!user) {
                    throw new Errors.MoleculerError('Unauthorized', 401);
                }

                const items = await (this.prisma as PrismaClient).item.findMany({
                    where: {
                        shopId,
                        itemItemCategories: { some: { categoryId } }
                    },
                    skip: pageSkip,
                    take: pageLimit,
                    orderBy: { createdAt: 'desc' }
                });

                return Promise.all(items.map(item => this.itemDataToFullItemInfo(item)));
            }
        },

        // Get single item
        get: {
            params: getItemRequestSchema as any,
            async handler(ctx: Context<{ id: string }, { currentUserId: string }>) {
                const { currentUserId } = ctx.meta;
                const { id } = ctx.params;

                const item = await (this.prisma as PrismaClient).item.findUnique({
                    where: { id },
                });

                if (!item) {
                    throw new Errors.MoleculerError('Item not found', 404);
                }

                const currentUser: { role: string, id: string } = await ctx.call("user.get", { id: currentUserId });
                if (!currentUser) {
                    throw new Errors.MoleculerError('Unauthorized', 401);
                }

                const shop : {ownerId: string}= await ctx.call("shop.get", { id: item.shopId });
                const onlyAvailable = currentUser.role !== 'ADMIN' && currentUser.id !== shop.ownerId;

                if (onlyAvailable && !item.available) {
                    throw new Errors.MoleculerError('Item not found', 404);
                }

                return Promise.all(this.itemDataToFullItemInfo(item));
            }
        },

        // Create item
        createItem: {
            params: createItemRequestSchema as any,
            async handler(ctx: Context<CreateItemRequest,{currentUserId: string}>) {
                const { currentUserId } = ctx.meta as any;
                const { shopId, name, description, available, stockout, price, priceWithoutPromotion, categories } = ctx.params;

                const user = await ctx.call("user.get", { id: currentUserId });
                if (!user) {
                    throw new Errors.MoleculerError('Unauthorized', 401);
                }

                const item = await (this.prisma as PrismaClient).item.create({
                    data: {
                        name,
                        description,
                        shopId,
                        available,
                        stockout,
                        price,
                        priceWithoutPromotion,
                        itemItemCategories: {
                            create: categories?.map((categoryId: string) => ({ categoryId }))
                        }
                    },
                });

                return Promise.all(this.itemDataToFullItemInfo(item));
            }
        },

        // Update item profile
        updateItemProfile: {
            params: updateItemProfileRequestSchema as any,
            async handler(ctx: Context<UpdateItemProfileRequest, { currentUserId: string }>) {
                const { currentUserId } = ctx.meta as any;
                const { id, name, description, available, stockout, price, priceWithoutPromotion, categories } = ctx.params;

                const item = await (this.prisma as PrismaClient).item.findUnique({ 
                    where: { id }
                });

                if (!item) {
                    throw new Errors.MoleculerError('Item not found', 404);
                }

                const currentUser: { role: string, id: string } = await ctx.call("user.get", { id: currentUserId });
                const shop: {ownerId: string} = await ctx.call("shop.get", { id: item.shopId });
                
                if (!currentUser || (currentUser.role !== 'admin' && currentUser.id !== shop.ownerId)) {
                    throw new Errors.MoleculerError('Permission denied', 403);
                }

                const updatedItem = await (this.prisma as PrismaClient).item.update({
                    where: { id },
                    data: {
                        name,
                        description,
                        available,
                        stockout,
                        price,
                        priceWithoutPromotion,
                        itemItemCategories: {
                            deleteMany: {},
                            create: categories?.map((categoryId: string) => ({ categoryId }))
                        }
                    },
                });

                return updatedItem;
            }
        },

        // Update item image
        updateItemImage: {
            async handler(ctx: Context<any, AuthMeta & { $params: UpdateItemImageRequest }>) {
                const stream = ctx.params;
                const { currentUserId, currentUserRole } = ctx.meta;
                const { id } = ctx.meta.$params;
                const { fieldname, mimetype } = ctx.meta as any;

                // 验证文件类型
                if (!mimetype.startsWith('image/')) {
                    throw new Errors.MoleculerError("Invalid image format", 400);
                }

                // 获取商品信息以验证权限
                const item = await (this.prisma as PrismaClient).item.findUnique({ 
                    where: { id } 
                });
                if (!item) {
                    throw new Errors.MoleculerError('Item not found', 404);
                }

                // 获取店铺信息验证权限
                const shop = await (this.prisma as PrismaClient).shop.findUnique({
                    where: { id: item.shopId }
                });
                if (!shop) {
                    throw new Errors.MoleculerError('Shop not found', 404);
                }

                // 权限验证：只有管理员或店铺所有者可以更新商品图片
                if (currentUserRole !== 'ADMIN' && currentUserId !== shop.ownerId) {
                    throw new Errors.MoleculerError("Forbidden", 403, "FORBIDDEN");
                }

                // 处理文件流
                const chunks: Buffer[] = [];
                for await (const chunk of stream as Readable) {
                    chunks.push(chunk);
                }
                const buffer = Buffer.concat(chunks);

                // 根据字段名确定上传的文件类型
                const [origin, thumbnail] = await Promise.all([
                    ctx.call("oss.putObject", sharp(buffer).toFormat('webp'), { meta: { objectName: `users/${id}/avatar.webp`, contentType: 'image/webp' } }),
                    ctx.call("oss.putObject", sharp(buffer).resize(128, 128).toFormat('webp'), { meta: { objectName: `users/${id}/avatar-thumbnail.webp`, contentType: 'image/webp' } })
                ])

                return { origin, thumbnail }
            }
        },

        deleteItem: {
            params: deleteItemRequestSchema as any,
            async handler(ctx: Context<DeleteItemRequest, { currentUserId: string}>) {
                const itemId = ctx.params.id;
                const { currentUserId,} = ctx.meta;
                
                const item = await (this.prisma as PrismaClient).item.findUnique({ 
                    where: { id: itemId },
                    include: { itemItemCategories: true }
                });

                if (!item) {
                    throw new Errors.MoleculerError('Item not found', 404);
                }

                const currentUser :User= await ctx.call("user.get", { id: currentUserId });
                const shop = await ctx.call("shop.get", { id: item.shopId });

                if (!currentUser || (currentUser.role !== 'ADMIN' )) {
                    throw new Errors.MoleculerError('Permission denied', 403);
                }
                

                // 执行删除操作
                await (this.prisma as PrismaClient).item.delete({ where: { id: itemId } });
                
                // 删除图片文件
                await Promise.all([
                    ctx.call("oss.removeObject", { objectName: `items/${itemId}/cover.webp` }),
                    ctx.call("oss.removeObject", { objectName: `items/${itemId}/cover-thumbnail.webp` }),
                ]);

                this.broker.emit("item.deleted", {
                    itemId: itemId,
                    shopId: item.shopId,
                    categories: item.itemItemCategories.map(ic => ic.categoryId) || [],
                    deletedBy: currentUserId,
                });

                return { success: true };
            }
        },

        // Update item sale count
        updateItemSale: {
            params: updateItemSaleRequestSchema as any,
            async handler(ctx: Context<UpdateItemSaleRequest>) {
                const { itemId, saleCount } = ctx.params;

                const item = await (this.prisma as PrismaClient).item.update({
                    where: { id: itemId },
                    data: { sale: saleCount }
                });

                return item;
            }
        },

        // Get shop item IDs
        getShopItemIds: {
            params: getShopItemIdsRequestSchema as any,
            async handler(ctx: Context<GetShopItemIdsRequest>) {
                const { shopId } = ctx.params;

                const items = await (this.prisma as PrismaClient).item.findMany({
                    where: { shopId },
                    select: { id: true }
                });

                return items.map((item: { id: string }) => item.id);
            }
        },

        // Update item rating
        updateItemRating: {
            params: updateItemRatingRequestSchema as any,
            async handler(ctx: Context<UpdateItemRatingRequest>) {
                const { itemId, rating } = ctx.params;

                const item = await (this.prisma as PrismaClient).item.update({
                    where: { id: itemId },
                    data: { rating }
                });

                return item;
            }
        },

        // Utility method to get item image links
        getItemImageLinks: {
            params: getItemRequestSchema as any,
            async handler(ctx: Context<GetItemRequest>) {
                const { id } = ctx.params;

                const [coverOrigin, coverThumbnail] = await Promise.all([
                    ctx.call("oss.getObjectUrl", { objectName: `items/${id}/cover.webp` }),
                    ctx.call("oss.getObjectUrl", { objectName: `items/${id}/cover-thumbnail.webp` }),
                ]);

                return {
                    cover: { origin: coverOrigin, thumbnail: coverThumbnail }
                };
            }
        }
    },

    methods: {
        itemCategoryDataToItemCategoryInfo(category: ItemCategory) {
            return {
                id: category.id,
                name: category.name,
            };
        },

        async itemDataToFullItemInfo(item: Prisma.ItemGetPayload<{ include: { itemItemCategories: true } }>) {
            return {
                id: item.id,
                shopId: item.shopId,
                createdAt: item.createdAt,
                ...this.itemDataToItemProfile(item),
                cover:await this.broker.call("item.getItemImageLinks", { id: item.id }),
            };
        },

        itemDataToItemProfile(item: Prisma.ItemGetPayload<{ include: { itemItemCategories: true } }>) {
            return {
                name: item.name,
                description: item.description,
                available: item.available,
                stockout: item.stockout,
                price: item.price,
                priceWithoutPromotion: item.priceWithoutPromotion,
                categories: item.itemItemCategories.map(p => p.categoryId),
                rating: item.rating,
                sale: item.sale,
            };
        }
    },

    async created() {
        this.prisma = new PrismaClient();
    },

    async stopped() {
            await (this.prisma as PrismaClient).$disconnect();
    }
};

export default ItemService;