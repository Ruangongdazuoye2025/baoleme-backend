import { Prisma, PrismaClient, } from "@prisma/client";
import { classInjection, injected } from "../util/injection-decorators";
import OSSService from "./oss.service";
import { ResponseError } from "../util/errors";
import ShopService from "./shop.service";
import ItemService from "./item.service";
import UserService from "./user.service";

@classInjection
export default class HistoryService {

    @injected
    private prisma!: PrismaClient

    @injected
    private shopService!: ShopService

    @injected
    private itemService!: ItemService

    @injected
    private userService!: UserService

    /**
     * 将商品历史数据转换为完整信息（通过服务调用获取关联数据）
     */
    async itemHistoryDataToFullItemHistoryInfo(itemHistory: { userId: string; itemId: string; createdAt: Date }) {
        // 通过服务调用获取商品信息
        const item = await this.itemService.getItem('system', itemHistory.itemId)
        if (!item) {
            throw new ResponseError(404, 'Item not found')
        }
        
        return {
            item: await this.itemService.itemDataToFullItemInfo(item),
            createdAt: itemHistory.createdAt
        }
    }

    /**
     * 将店铺历史数据转换为完整信息（通过服务调用获取关联数据）
     */
    async shopHistoryDataToFullShopHistoryInfo(shopHistory: { userId: string; shopId: string; createdAt: Date }) {
        // 通过服务调用获取店铺信息
        const shop = await this.shopService.getShop(shopHistory.shopId)
        if (!shop) {
            throw new ResponseError(404, 'Shop not found')
        }
        
        return {
            shop: await this.shopService.shopDataToFullShopInfo(shop),
            createdAt: shopHistory.createdAt
        }
    }

    /**
     * 将商品收藏数据转换为完整信息（通过服务调用获取关联数据）
     */
    async itemFavouriteDataToFullItemFavouriteInfo(itemFavourite: { userId: string; itemId: string; createdAt: Date }) {
        // 通过服务调用获取商品信息
        const item = await this.itemService.getItem('system', itemFavourite.itemId)
        if (!item) {
            throw new ResponseError(404, 'Item not found')
        }
        
        return {
            item: await this.itemService.itemDataToFullItemInfo(item),
            createdAt: itemFavourite.createdAt
        }
    }

    /**
     * 将店铺收藏数据转换为完整信息（通过服务调用获取关联数据）
     */
    async shopFavouriteDataToFullShopFavouriteInfo(shopFavourite: { userId: string; shopId: string; createdAt: Date }) {
        // 通过服务调用获取店铺信息
        const shop = await this.shopService.getShop(shopFavourite.shopId)
        if (!shop) {
            throw new ResponseError(404, 'Shop not found')
        }
        
        return {
            shop: await this.shopService.shopDataToFullShopInfo(shop),
            createdAt: shopFavourite.createdAt
        }
    }

    async getShopHistory(currentUserId: string, pageSkip: number, pageLimit: number) {
        return await this.prisma.$transaction(async tx => {
            // 验证用户权限
            const user = await this.userService.getUser(currentUserId)
            if (!user) {
                throw new ResponseError(401, 'Unauthorized');
            }
            
            // 获取店铺历史记录（不包含关联数据）
            const shopHistories = await tx.shopHistory.findMany({
                where: { userId: currentUserId },
                skip: pageSkip,
                take: pageLimit,
                orderBy: { createdAt: 'desc' }
            })
            
            // 通过服务调用获取完整信息
            return await Promise.all(shopHistories.map(async history => 
                await this.shopHistoryDataToFullShopHistoryInfo(history)
            ))
        })
    }

    async createShopHistory(currentUserId: string, shopId: string) {
        return await this.prisma.$transaction(async tx => {
            // 验证用户权限
            const user = await this.userService.getUser(currentUserId)
            if (!user) {
                throw new ResponseError(401, 'Unauthorized');
            }

            // 验证店铺存在
            const shop = await this.shopService.getShop(shopId)
            if (!shop) {
                throw new ResponseError(404, 'Shop not found')
            }

            const history = await tx.shopHistory.upsert({
                where: { userId_shopId: { userId: currentUserId, shopId } },
                update: { createdAt: new Date() },
                create: { userId: currentUserId, shopId }
            })
            
            // 返回完整信息
            return await this.shopHistoryDataToFullShopHistoryInfo(history)
        })
    }

    async getItemHistory(currentUserId: string, pageSkip: number, pageLimit: number) {
        return await this.prisma.$transaction(async tx => {
            // 验证用户权限
            const user = await this.userService.getUser(currentUserId)
            if (!user) {
                throw new ResponseError(401, 'Unauthorized');
            }
            
            // 获取商品历史记录（不包含关联数据）
            const itemHistories = await tx.itemHistory.findMany({
                where: { userId: currentUserId },
                skip: pageSkip,
                take: pageLimit,
                orderBy: { createdAt: 'desc' }
            })
            
            // 通过服务调用获取完整信息
            return await Promise.all(itemHistories.map(async history => 
                await this.itemHistoryDataToFullItemHistoryInfo(history)
            ))
        })
    }

    async createItemHistory(currentUserId: string, itemId: string) {
        return await this.prisma.$transaction(async tx => {
            // 验证用户权限
            const user = await this.userService.getUser(currentUserId)
            if (!user) {
                throw new ResponseError(401, 'Unauthorized');
            }

            // 验证商品存在
            const item = await this.itemService.getItem(currentUserId, itemId)
            if (!item) {
                throw new ResponseError(404, 'Item not found')
            }

            const history = await tx.itemHistory.upsert({
                where: { userId_itemId: { userId: currentUserId, itemId } },
                update: { createdAt: new Date() },
                create: { userId: currentUserId, itemId }
            })
            
            // 返回完整信息
            return await this.itemHistoryDataToFullItemHistoryInfo(history)
        })
    }

    async getShopFavourite(currentUserId: string, pageSkip: number, pageLimit: number) {
        return await this.prisma.$transaction(async tx => {
            // 验证用户权限
            const user = await this.userService.getUser(currentUserId)
            if (!user) {
                throw new ResponseError(401, 'Unauthorized');
            }
            
            // 获取店铺收藏记录（不包含关联数据）
            const shopFavourites = await tx.shopFavourite.findMany({
                where: { userId: currentUserId },
                skip: pageSkip,
                take: pageLimit,
                orderBy: { createdAt: 'desc' }
            })
            
            // 通过服务调用获取完整信息
            return await Promise.all(shopFavourites.map(async favourite => 
                await this.shopFavouriteDataToFullShopFavouriteInfo(favourite)
            ))
        })
    }

    async createShopFavourite(currentUserId: string, shopId: string) {
        return await this.prisma.$transaction(async tx => {
            // 验证用户权限
            const user = await this.userService.getUser(currentUserId)
            if (!user) {
                throw new ResponseError(401, 'Unauthorized');
            }

            // 验证店铺存在
            const shop = await this.shopService.getShop(shopId)
            if (!shop) {
                throw new ResponseError(404, 'Shop not found')
            }

            const favourite = await tx.shopFavourite.upsert({
                where: { userId_shopId: { userId: currentUserId, shopId } },
                update: { createdAt: new Date() },
                create: { userId: currentUserId, shopId }
            })
            
            // 返回完整信息
            return await this.shopFavouriteDataToFullShopFavouriteInfo(favourite)
        })
    }

    async getItemFavourite(currentUserId: string, pageSkip: number, pageLimit: number) {
        return await this.prisma.$transaction(async tx => {
            // 验证用户权限
            const user = await this.userService.getUser(currentUserId)
            if (!user) {
                throw new ResponseError(401, 'Unauthorized');
            }
            
            // 获取商品收藏记录（不包含关联数据）
            const itemFavourites = await tx.itemFavourite.findMany({
                where: { userId: currentUserId },
                skip: pageSkip,
                take: pageLimit,
                orderBy: { createdAt: 'desc' }
            })
            
            // 通过服务调用获取完整信息
            return await Promise.all(itemFavourites.map(async favourite => 
                await this.itemFavouriteDataToFullItemFavouriteInfo(favourite)
            ))
        })
    }

    async createItemFavourite(currentUserId: string, itemId: string) {
        return await this.prisma.$transaction(async tx => {
            // 验证用户权限
            const user = await this.userService.getUser(currentUserId)
            if (!user) {
                throw new ResponseError(401, 'Unauthorized');
            }

            // 验证商品存在
            const item = await this.itemService.getItem(currentUserId, itemId)
            if (!item) {
                throw new ResponseError(404, 'Item not found')
            }

            const favourite = await tx.itemFavourite.upsert({
                where: { userId_itemId: { userId: currentUserId, itemId } },
                update: { createdAt: new Date() },
                create: { userId: currentUserId, itemId }
            })
            
            // 返回完整信息
            return await this.itemFavouriteDataToFullItemFavouriteInfo(favourite)
        })
    }

    async getShopFavouriteById(currentUserId: string, shopId: string) {
        return await this.prisma.$transaction(async tx => {
            const favourite = await tx.shopFavourite.findUnique({
                where: { userId_shopId: { userId: currentUserId, shopId } }
            })
            if (!favourite) {
                throw new ResponseError(404, 'Shop favourite not found')
            }
            return await this.shopFavouriteDataToFullShopFavouriteInfo(favourite)
        })
    }

    async getItemFavouriteById(currentUserId: string, itemId: string) {
        return await this.prisma.$transaction(async tx => {
            const favourite = await tx.itemFavourite.findUnique({
                where: { userId_itemId: { userId: currentUserId, itemId } }
            })
            if (!favourite) {
                throw new ResponseError(404, 'Item favourite not found')
            }
            return await this.itemFavouriteDataToFullItemFavouriteInfo(favourite)
        })
    }

    async deleteShopHistory(currentUserId: string, shopId: string) {
        return await this.prisma.$transaction(async tx => {
            // 验证用户权限
            const user = await this.userService.getUser(currentUserId)
            if (!user) {
                throw new ResponseError(401, 'Unauthorized');
            }

            const history = await tx.shopHistory.findUnique({
                where: { userId_shopId: { userId: currentUserId, shopId } },
                select: { userId: true, shopId: true }
            });
            if (!history) {
                throw new ResponseError(404, 'Shop history not found');
            }
            return await tx.shopHistory.delete({
                where: { userId_shopId: history }
            });
        });
    }

    async deleteItemHistory(currentUserId: string, itemId: string) {
        return await this.prisma.$transaction(async tx => {
            // 验证用户权限
            const user = await this.userService.getUser(currentUserId)
            if (!user) {
                throw new ResponseError(401, 'Unauthorized');
            }

            const history = await tx.itemHistory.findUnique({
                where: { userId_itemId: { userId: currentUserId, itemId } },
                select: { userId: true, itemId: true }
            });
            if (!history) {
                throw new ResponseError(404, 'Item history not found');
            }
            return await tx.itemHistory.delete({
                where: { userId_itemId: history }
            });
        });
    }

    async deleteShopFavourite(currentUserId: string, shopId: string) {
        return await this.prisma.$transaction(async tx => {
            // 验证用户权限
            const user = await this.userService.getUser(currentUserId)
            if (!user) {
                throw new ResponseError(401, 'Unauthorized');
            }

            const favourite = await tx.shopFavourite.findUnique({
                where: { userId_shopId: { userId: currentUserId, shopId } },
                select: { userId: true, shopId: true }
            });
            if (!favourite) {
                throw new ResponseError(404, 'Shop favourite not found');
            }
            return await tx.shopFavourite.delete({
                where: { userId_shopId: favourite }
            });
        });
    }

    async deleteItemFavourite(currentUserId: string, itemId: string) {
        return await this.prisma.$transaction(async tx => {
            // 验证用户权限
            const user = await this.userService.getUser(currentUserId)
            if (!user) {
                throw new ResponseError(401, 'Unauthorized');
            }

            const favourite = await tx.itemFavourite.findUnique({
                where: { userId_itemId: { userId: currentUserId, itemId } },
                select: { userId: true, itemId: true }
            });
            if (!favourite) {
                throw new ResponseError(404, 'Item favourite not found');
            }
            return await tx.itemFavourite.delete({
                where: { userId_itemId: favourite }
            });
        });
    }
}