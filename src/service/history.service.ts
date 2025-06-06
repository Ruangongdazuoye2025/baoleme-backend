import { Prisma, PrismaClient, } from "@prisma/client";
import { classInjection, injected } from "../util/injection-decorators";
import OSSService from "./oss.service";
import { ResponseError } from "../util/errors";
import ShopService from "./shop.service";
import ItemService from "./item.service";

@classInjection
export default class HistoryService {

    @injected
    private prisma!: PrismaClient

    @injected
    private shopService!: ShopService

    @injected
    private itemService!: ItemService


    async itemHistoryDataToFullItemHistoryInfo(itemHistory: Prisma.ItemHistoryGetPayload<{ include: { item: { include: { categories: true; shop: true } } } }>) {
        return {
            item: this.itemService.itemDataToFullItemInfo(itemHistory.item),
            createdAt: itemHistory.createdAt
        }
    }

    async shopHistoryDataToFullShopHistoryInfo(shopHistory: Prisma.ShopHistoryGetPayload<{ include: { shop: { include: { categories: true; owner: true } } } }>) {
        return {
            shop: this.shopService.shopDataToFullShopInfo(shopHistory.shop),
            createdAt: shopHistory.createdAt
        }
    }

    async itemFavouriteDataToFullItemFavouriteInfo(itemFavourite: Prisma.ItemFavouriteGetPayload<{ include: { item: { include: { categories: true; shop: true } } } }>) {
        return {
            item: this.itemService.itemDataToFullItemInfo(itemFavourite.item),
            createdAt: itemFavourite.createdAt
        }
    }

    async shopFavouriteDataToFullShopFavouriteInfo(shopFavourite: Prisma.ShopFavouriteGetPayload<{ include: { shop: { include: { categories: true; owner: true } } } }>) {
        return {
            shop: this.shopService.shopDataToFullShopInfo(shopFavourite.shop),
            createdAt: shopFavourite.createdAt
        }
    }

    async getShopHistory(currentUserId: string, pageSkip: number, pageLimit: number) {
        return await this.prisma.$transaction(async tx => {
            const user = await tx.user.findUnique({
                where: { id: currentUserId }
            })
            if (!user) {
                throw new ResponseError(401, 'Unauthorized');
            }
            return await tx.shopHistory.findMany({
                where: {
                    userId: currentUserId
                },
                include: {
                    shop: {
                        include: {
                            owner: true,
                            categories: true,
                        }
                    }
                },
                skip: pageSkip,
                take: pageLimit,
                orderBy: { createdAt: 'desc' }
            })
        })
    }

    async createShopHistory(currentUserId: string, shopId: string) {
        return await this.prisma.$transaction(async tx => {
            const user = await tx.user.findUnique({
                where: { id: currentUserId }
            })
            if (!user) {
                throw new ResponseError(401, 'Unauthorized');
            }

            const shop = await tx.shop.findUnique({
                where: { id: shopId }
            })
            if (!shop) {
                throw new ResponseError(404, 'Shop not found')
            }

            return await tx.shopHistory.upsert({
                where: { userId_shopId: { userId: currentUserId, shopId } },
                update: { createdAt: new Date() },
                create: { userId: currentUserId, shopId },
                include: {
                    shop: {
                        include: {
                            owner: true,
                            categories: true,
                        }
                    }
                },
            })
        })
    }

    async getItemHistory(currentUserId: string, pageSkip: number, pageLimit: number) {
        return await this.prisma.$transaction(async tx => {
            const user = await tx.user.findUnique({
                where: { id: currentUserId }
            })
            if (!user) {
                throw new ResponseError(401, 'Unauthorized');
            }
            return await tx.itemHistory.findMany({
                where: {
                    userId: currentUserId
                },
                include: {
                    item: {
                        include: {
                            categories: true,
                            shop: true,
                        }
                    }
                },
                skip: pageSkip,
                take: pageLimit,
                orderBy: { createdAt: 'desc' }
            })
        })
    }

    async createItemHistory(currentUserId: string, itemId: string) {
        return await this.prisma.$transaction(async tx => {
            const user = await tx.user.findUnique({
                where: { id: currentUserId }
            })
            if (!user) {
                throw new ResponseError(401, 'Unauthorized');
            }

            const item = await tx.item.findUnique({
                where: { id: itemId }
            })
            if (!item) {
                throw new ResponseError(404, 'Item not found')
            }

            return await tx.itemHistory.upsert({
                where: { userId_itemId: { userId: currentUserId, itemId } },
                update: { createdAt: new Date() },
                create: { userId: currentUserId, itemId },
                include: {
                    item: {
                        include: {
                            shop: true,
                            categories: true,
                        }
                    }
                },
            })
        })
    }

    async getShopFavourite(currentUserId: string, pageSkip: number, pageLimit: number) {
        return await this.prisma.$transaction(async tx => {
            const user = await tx.user.findUnique({
                where: { id: currentUserId }
            })
            if (!user) {
                throw new ResponseError(401, 'Unauthorized');
            }
            return await tx.shopFavourite.findMany({
                where: {
                    userId: currentUserId
                },
                include: {
                    shop: {
                        include: {
                            owner: true,
                            categories: true,
                        }
                    }
                },
                skip: pageSkip,
                take: pageLimit,
                orderBy: { createdAt: 'desc' }
            })
        })
    }

    async createShopFavourite(currentUserId: string, shopId: string) {
        return await this.prisma.$transaction(async tx => {
            const user = await tx.user.findUnique({
                where: { id: currentUserId }
            })
            if (!user) {
                throw new ResponseError(401, 'Unauthorized');
            }

            const shop = await tx.shop.findUnique({
                where: { id: shopId }
            })
            if (!shop) {
                throw new ResponseError(404, 'Shop not found')
            }

            return await tx.shopFavourite.upsert({
                where: { userId_shopId: { userId: currentUserId, shopId } },
                update: { createdAt: new Date() },
                create: { userId: currentUserId, shopId },
                include: {
                    shop: {
                        include: {
                            owner: true,
                            categories: true,
                        }
                    }
                },
            })
        })
    }

    async getItemFavourite(currentUserId: string, pageSkip: number, pageLimit: number) {
        return await this.prisma.$transaction(async tx => {
            const user = await tx.user.findUnique({
                where: { id: currentUserId }
            })
            if (!user) {
                throw new ResponseError(401, 'Unauthorized');
            }
            return await tx.itemFavourite.findMany({
                where: {
                    userId: currentUserId
                },
                include: {
                    item: {
                        include: {
                            shop: true,
                            categories: true,
                        }
                    }
                },
                skip: pageSkip,
                take: pageLimit,
                orderBy: { createdAt: 'desc' }
            })
        })
    }

    async createItemFavourite(currentUserId: string, itemId: string) {
        return await this.prisma.$transaction(async tx => {
            const user = await tx.user.findUnique({
                where: { id: currentUserId }
            })
            if (!user) {
                throw new ResponseError(401, 'Unauthorized');
            }

            const item = await tx.item.findUnique({
                where: { id: itemId }
            })
            if (!item) {
                throw new ResponseError(404, 'Item not found')
            }

            return await tx.itemFavourite.upsert({
                where: { userId_itemId: { userId: currentUserId, itemId } },
                update: { createdAt: new Date() },
                create: { userId: currentUserId, itemId },
                include: {
                    item: {
                        include: {
                            shop: true,
                            categories: true,
                        }
                    }
                },
            })
        })
    }

    async deleteShopHistory(currentUserId: string, shopId: string) {
        return await this.prisma.$transaction(async tx => {
            const user = await tx.user.findUnique({
                where: { id: currentUserId }
            });
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
            const user = await tx.user.findUnique({
                where: { id: currentUserId }
            });
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
            const user = await tx.user.findUnique({
                where: { id: currentUserId }
            });
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
            const user = await tx.user.findUnique({
                where: { id: currentUserId }
            });
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