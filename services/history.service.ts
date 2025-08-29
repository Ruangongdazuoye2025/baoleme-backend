import { Context, ServiceSchema, Errors } from "moleculer";
import { PrismaClient, RecordType } from "@prisma/client";
import Joi from "joi";

// Joi Schema 定义 - 根据不同action的参数需求分别定义
const historyListRequestSchema = Joi.object({
    p: Joi.number().min(0).default(0),
    pn: Joi.number().min(1).max(100).default(10)
});

const historyIdRequestSchema = Joi.object({
    id: Joi.string().uuid().required()
});

// TypeScript Interface 定义
interface HistoryListRequest {
    p: number;
    pn: number;
}

interface HistoryIdRequest {
    id: string;
}

const HISTORY_ERROR_MESSAGES = {
    ITEM_NOT_FOUND: 'Item not found',
    SHOP_NOT_FOUND: 'Shop not found',
    SHOP_HISTORY_NOT_FOUND: 'Shop history not found',
    ITEM_HISTORY_NOT_FOUND: 'Item history not found',
    SHOP_FAVOURITE_NOT_FOUND: 'Shop favourite not found',
    ITEM_FAVOURITE_NOT_FOUND: 'Item favourite not found',
} as const;

const HistoryService: ServiceSchema = {
    name: "history",

    actions: {
        // Get shop history list
        getShopHistory: {
            params: historyListRequestSchema as any,
            async handler(ctx: Context<HistoryListRequest, { currentUserId: string }>) {
                const { currentUserId } = ctx.meta;
                const { p, pn } = ctx.params;
                const pageSkip = p * pn;
                const pageLimit = pn;

                return await (this.prisma as PrismaClient).$transaction(async tx => {
                    // 获取店铺历史记录（不包含关联数据）
                    const shopHistories = await tx.shopRecord.findMany({
                        where: { userId: currentUserId, type: RecordType.HISTORY },
                        skip: pageSkip,
                        take: pageLimit,
                        orderBy: { createdAt: 'desc' }
                    });
                    
                    // 通过服务调用获取完整信息
                    return await Promise.all(shopHistories.map(async history => 
                        await this.shopHistoryDataToFullShopHistoryInfo(ctx, history)
                    ));
                });
            }
        },

        // Create shop history
        createShopHistory: {
            params: historyIdRequestSchema as any,
            async handler(ctx: Context<HistoryIdRequest, { currentUserId: string }>) {
                const { currentUserId } = ctx.meta;
                const { id: shopId } = ctx.params;

                return await (this.prisma as PrismaClient).$transaction(async tx => {
                    // 验证店铺存在
                    const shop = await ctx.call("shop.get", { id: shopId });
                    if (!shop) {
                        throw new Errors.MoleculerError(HISTORY_ERROR_MESSAGES.SHOP_NOT_FOUND, 404);
                    }

                    const history = await tx.shopRecord.upsert({
                        where: { userId_shopId: { userId: currentUserId, shopId } },
                        update: { createdAt: new Date() },
                        create: { userId: currentUserId, shopId, type: RecordType.HISTORY }
                    });
                    
                    // 返回完整信息
                    return await this.shopHistoryDataToFullShopHistoryInfo(ctx, history);
                });
            }
        },

        // Get item history list
        getItemHistory: {
            params: historyListRequestSchema as any,
            async handler(ctx: Context<HistoryListRequest, { currentUserId: string }>) {
                const { currentUserId } = ctx.meta;
                const { p, pn } = ctx.params;
                const pageSkip = p * pn;
                const pageLimit = pn;

                return await (this.prisma as PrismaClient).$transaction(async tx => {
                    // 获取商品历史记录（不包含关联数据）
                    const itemHistories = await tx.itemRecord.findMany({
                        where: { userId: currentUserId, type: RecordType.HISTORY },
                        skip: pageSkip,
                        take: pageLimit,
                        orderBy: { createdAt: 'desc' }
                    });
                    
                    // 通过服务调用获取完整信息
                    return await Promise.all(itemHistories.map(async history => 
                        await this.itemHistoryDataToFullItemHistoryInfo(ctx, history)
                    ));
                });
            }
        },

        // Create item history
        createItemHistory: {
            params: historyIdRequestSchema as any,
            async handler(ctx: Context<HistoryIdRequest, { currentUserId: string }>) {
                const { currentUserId } = ctx.meta;
                const { id: itemId } = ctx.params;

                return await (this.prisma as PrismaClient).$transaction(async tx => {
                    // 验证商品存在
                    const item = await ctx.call("item.get", { id: itemId });
                    if (!item) {
                        throw new Errors.MoleculerError(HISTORY_ERROR_MESSAGES.ITEM_NOT_FOUND, 404);
                    }

                    const history = await tx.itemRecord.upsert({
                        where: { userId_itemId: { userId: currentUserId, itemId } },
                        update: { createdAt: new Date() },
                        create: { userId: currentUserId, itemId, type: RecordType.HISTORY }
                    });
                    
                    // 返回完整信息
                    return await this.itemHistoryDataToFullItemHistoryInfo(ctx, history);
                });
            }
        },

        // Get shop favourites list
        getShopFavourite: {
            params: historyListRequestSchema as any,
            async handler(ctx: Context<HistoryListRequest, { currentUserId: string }>) {
                const { currentUserId } = ctx.meta;
                const { p, pn } = ctx.params;
                const pageSkip = p * pn;
                const pageLimit = pn;

                return await (this.prisma as PrismaClient).$transaction(async tx => {
                    // 获取店铺收藏记录（不包含关联数据）
                    const shopFavourites = await tx.shopRecord.findMany({
                        where: { userId: currentUserId, type: RecordType.FAVORITE },
                        skip: pageSkip,
                        take: pageLimit,
                        orderBy: { createdAt: 'desc' }
                    });
                    
                    // 通过服务调用获取完整信息
                    return await Promise.all(shopFavourites.map(async favourite => 
                        await this.shopFavouriteDataToFullShopFavouriteInfo(ctx, favourite)
                    ));
                });
            }
        },

        // Create shop favourite
        createShopFavourite: {
            params: historyIdRequestSchema as any,
            async handler(ctx: Context<HistoryIdRequest, { currentUserId: string }>) {
                const { currentUserId } = ctx.meta;
                const { id: shopId } = ctx.params;

                return await (this.prisma as PrismaClient).$transaction(async tx => {
                    // 验证店铺存在
                    const shop = await ctx.call("shop.get", { id: shopId });
                    if (!shop) {
                        throw new Errors.MoleculerError(HISTORY_ERROR_MESSAGES.SHOP_NOT_FOUND, 404);
                    }

                    const favourite = await tx.shopRecord.upsert({
                        where: { userId_shopId: { userId: currentUserId, shopId } },
                        update: { createdAt: new Date() },
                        create: { userId: currentUserId, shopId, type: RecordType.FAVORITE }
                    });
                    
                    // 返回完整信息
                    return await this.shopFavouriteDataToFullShopFavouriteInfo(ctx, favourite);
                });
            }
        },

        // Get item favourites list
        getItemFavourite: {
            params: historyListRequestSchema as any,
            async handler(ctx: Context<HistoryListRequest, { currentUserId: string }>) {
                const { currentUserId } = ctx.meta;
                const { p, pn } = ctx.params;
                const pageSkip = p * pn;
                const pageLimit = pn;

                return await (this.prisma as PrismaClient).$transaction(async tx => {
                    // 获取商品收藏记录（不包含关联数据）
                    const itemFavourites = await tx.itemRecord.findMany({
                        where: { userId: currentUserId, type: RecordType.FAVORITE },
                        skip: pageSkip,
                        take: pageLimit,
                        orderBy: { createdAt: 'desc' }
                    });
                    
                    // 通过服务调用获取完整信息
                    return await Promise.all(itemFavourites.map(async favourite => 
                        await this.itemFavouriteDataToFullItemFavouriteInfo(ctx, favourite)
                    ));
                });
            }
        },

        // Create item favourite
        createItemFavourite: {
            params: historyIdRequestSchema as any,
            async handler(ctx: Context<HistoryIdRequest, { currentUserId: string }>) {
                const { currentUserId } = ctx.meta;
                const { id: itemId } = ctx.params;

                return await (this.prisma as PrismaClient).$transaction(async tx => {
                    // 验证商品存在
                    const item = await ctx.call("item.get", { id: itemId });
                    if (!item) {
                        throw new Errors.MoleculerError(HISTORY_ERROR_MESSAGES.ITEM_NOT_FOUND, 404);
                    }

                    const favourite = await tx.itemRecord.upsert({
                        where: { userId_itemId: { userId: currentUserId, itemId } },
                        update: { createdAt: new Date() },
                        create: { userId: currentUserId, itemId, type: RecordType.FAVORITE }
                    });
                    
                    // 返回完整信息
                    return await this.itemFavouriteDataToFullItemFavouriteInfo(ctx, favourite);
                });
            }
        },

        // Get shop favourite by ID
        getShopFavouriteById: {
            params: historyIdRequestSchema as any,
            async handler(ctx: Context<HistoryIdRequest, { currentUserId: string }>) {
                const { currentUserId } = ctx.meta;
                const { id: shopId } = ctx.params;

                return await (this.prisma as PrismaClient).$transaction(async tx => {
                    const favourite = await tx.shopRecord.findUnique({
                        where: { userId_shopId: { userId: currentUserId, shopId } }
                    });
                    if (!favourite) {
                        throw new Errors.MoleculerError(HISTORY_ERROR_MESSAGES.SHOP_FAVOURITE_NOT_FOUND, 404);
                    }
                    return await this.shopFavouriteDataToFullShopFavouriteInfo(ctx, favourite);
                });
            }
        },

        // Get item favourite by ID
        getItemFavouriteById: {
            params: historyIdRequestSchema as any,
            async handler(ctx: Context<HistoryIdRequest, { currentUserId: string }>) {
                const { currentUserId } = ctx.meta;
                const { id: itemId } = ctx.params;

                return await (this.prisma as PrismaClient).$transaction(async tx => {
                    const favourite = await tx.itemRecord.findUnique({
                        where: { userId_itemId: { userId: currentUserId, itemId } }
                    });
                    if (!favourite) {
                        throw new Errors.MoleculerError(HISTORY_ERROR_MESSAGES.ITEM_FAVOURITE_NOT_FOUND, 404);
                    }
                    return await this.itemFavouriteDataToFullItemFavouriteInfo(ctx, favourite);
                });
            }
        },

        // Delete shop history
        deleteShopHistory: {
            params: historyIdRequestSchema as any,
            async handler(ctx: Context<HistoryIdRequest, { currentUserId: string }>) {
                const { currentUserId } = ctx.meta;
                const { id: shopId } = ctx.params;

                return await (this.prisma as PrismaClient).$transaction(async tx => {
                    const history = await tx.shopRecord.findUnique({
                        where: { userId_shopId: { userId: currentUserId, shopId }, type: RecordType.HISTORY },
                        select: { userId: true, shopId: true, type: true }
                    });
                    if (!history) {
                        throw new Errors.MoleculerError(HISTORY_ERROR_MESSAGES.SHOP_HISTORY_NOT_FOUND, 404);
                    }
                    return await tx.shopRecord.delete({
                        where: { userId_shopId: { userId: history.userId, shopId: history.shopId } }
                    });
                });
            }
        },

        // Delete item history
        deleteItemHistory: {
            params: historyIdRequestSchema as any,
            async handler(ctx: Context<HistoryIdRequest, { currentUserId: string }>) {
                const { currentUserId } = ctx.meta;
                const { id: itemId } = ctx.params;

                return await (this.prisma as PrismaClient).$transaction(async tx => {
                    const history = await tx.itemRecord.findUnique({
                        where: { userId_itemId: { userId: currentUserId, itemId }, type: RecordType.HISTORY },
                        select: { userId: true, itemId: true, type: true }
                    });
                    if (!history) {
                        throw new Errors.MoleculerError(HISTORY_ERROR_MESSAGES.ITEM_HISTORY_NOT_FOUND, 404);
                    }
                    return await tx.itemRecord.delete({
                        where: { userId_itemId: { userId: history.userId, itemId: history.itemId } }
                    });
                });
            }
        },

        // Delete shop favourite
        deleteShopFavourite: {
            params: historyIdRequestSchema as any,
            async handler(ctx: Context<HistoryIdRequest, { currentUserId: string }>) {
                const { currentUserId } = ctx.meta;
                const { id: shopId } = ctx.params;

                return await (this.prisma as PrismaClient).$transaction(async tx => {
                    const favourite = await tx.shopRecord.findUnique({
                        where: { userId_shopId: { userId: currentUserId, shopId }, type: RecordType.FAVORITE },
                        select: { userId: true, shopId: true, type: true }
                    });
                    if (!favourite) {
                        throw new Errors.MoleculerError(HISTORY_ERROR_MESSAGES.SHOP_FAVOURITE_NOT_FOUND, 404);
                    }
                    return await tx.shopRecord.delete({
                        where: { userId_shopId: { userId: favourite.userId, shopId: favourite.shopId } }
                    });
                });
            }
        },

        // Delete item favourite
        deleteItemFavourite: {
            params: historyIdRequestSchema as any,
            async handler(ctx: Context<HistoryIdRequest, { currentUserId: string }>) {
                const { currentUserId } = ctx.meta;
                const { id: itemId } = ctx.params;

                return await (this.prisma as PrismaClient).$transaction(async tx => {
                    const favourite = await tx.itemRecord.findUnique({
                        where: { userId_itemId: { userId: currentUserId, itemId }, type: RecordType.FAVORITE },
                        select: { userId: true, itemId: true, type: true }
                    });
                    if (!favourite) {
                        throw new Errors.MoleculerError(HISTORY_ERROR_MESSAGES.ITEM_FAVOURITE_NOT_FOUND, 404);
                    }
                    return await tx.itemRecord.delete({
                        where: { userId_itemId: { userId: favourite.userId, itemId: favourite.itemId } }
                    });
                });
            }
        }
    },

    methods: {
        /**
         * 将商品历史数据转换为完整信息（通过服务调用获取关联数据）
         */
        async itemHistoryDataToFullItemHistoryInfo(ctx: Context, itemHistory: { userId: string; itemId: string; createdAt: Date }) {
            // 通过服务调用获取商品信息
            const item = await ctx.call("item.get", { id: itemHistory.itemId });
            if (!item) {
                throw new Errors.MoleculerError(HISTORY_ERROR_MESSAGES.ITEM_NOT_FOUND, 404);
            }
            
            return {
                item,
                createdAt: itemHistory.createdAt
            };
        },

        /**
         * 将店铺历史数据转换为完整信息（通过服务调用获取关联数据）
         */
        async shopHistoryDataToFullShopHistoryInfo(ctx: Context, shopHistory: { userId: string; shopId: string; createdAt: Date }) {
            // 通过服务调用获取店铺信息
            const shop = await ctx.call("shop.get", { id: shopHistory.shopId });
            if (!shop) {
                throw new Errors.MoleculerError(HISTORY_ERROR_MESSAGES.SHOP_NOT_FOUND, 404);
            }
            
            return {
                shop,
                createdAt: shopHistory.createdAt
            };
        },

        /**
         * 将商品收藏数据转换为完整信息（通过服务调用获取关联数据）
         */
        async itemFavouriteDataToFullItemFavouriteInfo(ctx: Context, itemFavourite: { userId: string; itemId: string; createdAt: Date }) {
            // 通过服务调用获取商品信息
            const item = await ctx.call("item.get", { id: itemFavourite.itemId });
            if (!item) {
                throw new Errors.MoleculerError(HISTORY_ERROR_MESSAGES.ITEM_NOT_FOUND, 404);
            }
            
            return {
                item,
                createdAt: itemFavourite.createdAt
            };
        },

        /**
         * 将店铺收藏数据转换为完整信息（通过服务调用获取关联数据）
         */
        async shopFavouriteDataToFullShopFavouriteInfo(ctx: Context, shopFavourite: { userId: string; shopId: string; createdAt: Date }) {
            // 通过服务调用获取店铺信息
            const shop = await ctx.call("shop.get", { id: shopFavourite.shopId });
            if (!shop) {
                throw new Errors.MoleculerError(HISTORY_ERROR_MESSAGES.SHOP_NOT_FOUND, 404);
            }
            
            return {
                shop,
                createdAt: shopFavourite.createdAt
            };
        }
    },

    created() {
        this.prisma = new PrismaClient();
    }
};

export default HistoryService;
