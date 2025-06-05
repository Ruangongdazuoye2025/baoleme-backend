import { Prisma, PrismaClient, } from "@prisma/client";
import { classInjection, injected } from "../util/injection-decorators";
import OSSService from "./oss.service";
import { ResponseError } from "../util/errors";

@classInjection
export default class HistoryService {

    @injected
    private prisma!: PrismaClient

    @injected
    private ossService!: OSSService

    async getShopImageLinks(shopId: string) {
        const [coverOrigin, coverThumbnail, detailOrigin, detailThumbnail, licenseOrigin, licenseThumbnail] = await Promise.all([
            this.ossService.getObjectUrl(`shops/${shopId}/cover.webp`),
            this.ossService.getObjectUrl(`shops/${shopId}/cover-thumbnail.webp`),
            this.ossService.getObjectUrl(`shops/${shopId}/detail.webp`),
            this.ossService.getObjectUrl(`shops/${shopId}/detail-thumbnail.webp`),
            this.ossService.getObjectUrl(`shops/${shopId}/license.webp`),
            this.ossService.getObjectUrl(`shops/${shopId}/license-thumbnail.webp`),
        ])
        return {
            cover: { origin: coverOrigin, thumbnail: coverThumbnail },
            detailImage: { origin: detailOrigin, thumbnail: detailThumbnail },
            license: { origin: licenseOrigin, thumbnail: licenseThumbnail }
        }
    }

    async shopDataToFullShopInfo(shop: Prisma.ShopGetPayload<{ include: { categories: true } }>) {
        return {
            id: shop.id,
            owner: shop.ownerId,
            createdAt: shop.createdAt,
            ...this.shopDataToShopProfile(shop),
            ...await this.getShopImageLinks(shop.id),
            rating: shop.rating,
            sale: shop.sale,
            averagePrice: shop.averagePrice,
        }
    }

    shopDataToShopProfile(shop: Prisma.ShopGetPayload<{ include: { categories: true } }>) {
        return {
            name: shop.name,
            description: shop.description,
            categories: shop.categories.map(category => category.id),
            address: {
                coordinate: [shop.addressLatitude, shop.addressLongitude],
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
        }
    }

    async getItemImageLinks(itemId: string) {
        const [coverOrigin, coverThumbnail] = await Promise.all([
            this.ossService.getObjectUrl(`items/${itemId}/cover.webp`),
            this.ossService.getObjectUrl(`items/${itemId}/cover-thumbnail.webp`),
        ])
        return {
            cover: { origin: coverOrigin, thumbnail: coverThumbnail }
        }
    }

    async itemDataToFullItemInfo(item: Prisma.ItemGetPayload<{ include: { categories: true, shop: true } }>) {
        return {
            id: item.id,
            shopId: item.shopId,
            createdAt: item.createdAt,
            ...this.itemDataToItemProfile(item),
            ...await this.getItemImageLinks(item.id),
        }
    }

    itemDataToItemProfile(item: Prisma.ItemGetPayload<{ include: { categories: true, shop: true } }>) {
        return {
            name: item.name,
            description: item.description,
            available: item.available,
            stockout: item.stockout,
            price: item.price,
            priceWithoutPromotion: item.priceWithoutPromotion,
            categories: item.categories.map(category => category.id),
            rating:item.rating,
            sale:item.sale,
        }
    }
    async itemHistoryDataToFullItemHistoryInfo(itemHistory: Prisma.ItemHistoryGetPayload<{ include:{item:{include:{categories:true;shop:true}}}}>){
        return {
            id: itemHistory.id,
            ...this.itemDataToFullItemInfo(itemHistory.item),
            createdAt: itemHistory.createdAt
        }
    }

    async shopHistoryDataToFullShopHistoryInfo(shopHistory: Prisma.ShopHistoryGetPayload<{ include:{shop:{include:{categories:true;owner:true}}}}>){
        return {
            id: shopHistory.id,
            ...this.shopDataToFullShopInfo(shopHistory.shop),
            createdAt: shopHistory.createdAt
        }
    }

    async itemFavouriteDataToFullItemFavouriteInfo(itemFavourite: Prisma.ItemFavouriteGetPayload<{ include:{item:{include:{categories:true;shop:true}}}}>){
        return {
            id: itemFavourite.id,
            ...this.itemDataToFullItemInfo(itemFavourite.item),
            createdAt: itemFavourite.createdAt
        }
    }

    async shopFavouriteDataToFullShopFavouriteInfo(shopFavourite: Prisma.ShopFavouriteGetPayload<{ include:{shop:{include:{categories:true;owner:true}}}}>){
        return {
            id: shopFavourite.id,
            ...this.shopDataToFullShopInfo(shopFavourite.shop),
            createdAt: shopFavourite.createdAt
        }
    }

    async getShopHistory(currentUserId:string,pageSkip:number,pageLimit:number){
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

    async createShopHistory(currentUserId:string,shopId:string){
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

            const existingHistory = await tx.shopHistory.findFirst({
                where: {
                    userId: currentUserId,
                    shopId: shopId
                }
            })
            if (existingHistory) {
                return await tx.shopHistory.update({
                    where: { id: existingHistory.id },
                    data: { createdAt: new Date() },
                    include: {
                    shop: {
                        include: {
                            owner: true,
                            categories: true,
                        }
                    }
                },
                })
            } else {
                return await tx.shopHistory.create({
                    data: {
                        userId: currentUserId,
                        shopId: shopId,
                        createdAt: new Date()
                    },
                    include: {
                    shop: {
                        include: {
                            owner: true,
                            categories: true,
                        }
                    }
                },
                })
            }

        })
    }

    async getItemHistory(currentUserId:string,pageSkip:number,pageLimit:number){
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

    async createItemHistory(currentUserId:string,itemId:string){
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

            const existingHistory = await tx.itemHistory.findFirst({
                where: {
                    userId: currentUserId,
                    itemId: itemId
                }
            })
            if (existingHistory) {
                return await tx.itemHistory.update({
                    where: { id: existingHistory.id },
                    data: { createdAt: new Date() },
                    include: {
                    item: {
                        include: {
                            categories: true,
                            shop: true,
                        }
                    }
                },
                })
            } else {
                return await tx.itemHistory.create({
                    data: {
                        userId: currentUserId,
                        itemId: itemId,
                        createdAt: new Date()
                    },
                    include: {
                    item: {
                        include: {
                            shop: true,
                            categories: true,
                        }
                    }
                    },
                })
            }

        })
    }

    async getShopFavourite(currentUserId:string,pageSkip:number,pageLimit:number){
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

    async createShopFavourite(currentUserId:string,shopId:string){
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

            const shopFavourite= await tx.shopFavourite.create({
                data: {
                    userId: currentUserId,
                    shopId: shopId,
                    createdAt: new Date()
                },
                include: {
                    shop: {
                        include: {
                            owner: true,
                            categories: true,
                        }
                    }
                },
            })
            return shopFavourite
        })
    }

    async getItemFavourite(currentUserId:string,pageSkip:number,pageLimit:number){
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

    async createItemFavourite(currentUserId:string,itemId:string){
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

            const itemFavourite= await tx.itemFavourite.create({
                data: {
                    userId: currentUserId,
                    itemId: itemId,
                    createdAt: new Date()
                },
                include: {
                    item: {
                        include: {
                            shop: true,
                            categories: true,
                        }
                    }
                },
            })
            return itemFavourite
        })
    }
}