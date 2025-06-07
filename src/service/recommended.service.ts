import { Prisma, PrismaClient, Shop, ShopCategory, User } from "@prisma/client";
import { classInjection, injected } from "../util/injection-decorators";
import OSSService from "./oss.service";
import { ResponseError } from "../util/errors";
import ShopService from "./shop.service";
import { getShops } from "@prisma/client/sql";

@classInjection
export default class RecommendedService {

    @injected
    private prisma!: PrismaClient

    @injected
    private ossService!: OSSService

    @injected
    private shopService!: ShopService

    async itemDataToRecommendedItemInfo(
        item: Prisma.ItemGetPayload<{ include: { categories: true } }>
    ) {
        const [coverOrigin, coverThumbnail] = await Promise.all([
            this.ossService.getObjectUrl(`items/${item.id}/cover.webp`),
            this.ossService.getObjectUrl(`items/${item.id}/cover-thumbnail.webp`),
        ])
        return {
            id: item.id,
            shopId: item.shopId,
            createdAt: item.createdAt,
            name: item.name,
            description: item.description,
            available: item.available,
            stockout: item.stockout,
            price: item.price,
            priceWithoutPromotion: item.priceWithoutPromotion,
            categories: item.categories.map(c => c.id),
            cover: { origin: coverOrigin, thumbnail: coverThumbnail },
            rating: item.rating,
            sale: item.sale
        }
    }

    async shopDataToRecommendedShopInfo(
        shop: Prisma.ShopGetPayload<{ include: { categories: true } }> & { distance: number },
        recommends: Prisma.ItemGetPayload<{ include: { categories: true } }>[]
    ) {
        return {
            ...this.shopService.shopDataToFullShopInfo(shop),
            time: shop.distance * 13,
            distance: shop.distance,
            recommends: recommends.map(i => this.itemDataToRecommendedItemInfo(i))
        }
    }

    async getRecommendedShops(
        currentUserId: string,
        pageSkip: number,
        pageLimit: number,
        filterKeywords: string[],
        sorting: string,
        hotItemCount: number,
        categories?: string[],
        maxDistance?: number,
        minRating?: number,
        maxTime?: number,
        addressId?: string
    ) {
        return await this.prisma.$transaction(async tx => {
            const currentUser = await tx.user.findUnique({ where: { id: currentUserId } });
            if (!currentUser) {
                throw new ResponseError(403, 'Permission denied');
            }

            if (categories) {
                const matchedCategories = await tx.shopCategory.findMany({
                    where: {
                        id: {
                            in: categories
                        }
                    }
                });
                if (categories.length != matchedCategories.length) {
                    throw new ResponseError(404, 'Categories not found');
                }
            }
            categories ??= []

            if (maxTime) {
                const distanceByTime = maxTime / 13;
                maxDistance = maxDistance ? Math.min(maxDistance, distanceByTime) : distanceByTime;
            }
            maxDistance ??= 50;

            const address = await tx.address.findUnique({ where: { id: addressId } });
            if (!address) {
                throw new ResponseError(404, 'Address not found');
            }

            const cLatitude = 111;
            const cLongitude = 111 * Math.cos((address.latitude * Math.PI) / 180);

            minRating ??= 0

            const date = new Date();
            const currentTime = date.getMinutes() + date.getHours() * 60;

            const shops = await this.prisma.$queryRawTyped(getShops(
                address.latitude,
                cLatitude,
                address.longitude,
                cLongitude,
                maxDistance,
                filterKeywords,
                categories,
                minRating,
                currentTime,
                sorting,
                pageLimit,
                pageSkip,
            ));

            return await Promise.all(
                shops.map(async (s) => {
                    const topItems = await this.prisma.item.findMany({
                        where: { shopId: s.id },
                        orderBy: { sale: 'desc' },
                        take: hotItemCount,
                        include: { categories: true },
                    });

                    return this.shopDataToRecommendedShopInfo(
                        {
                            ...s,
                            distance: s.distance ?? 0,
                            categories: (s.categories ?? []) as { order: number; id: string; name: string }[]
                        },
                        topItems
                    );
                })
            );
        })
    }

    async getRecommendedItems(userId: string) {
        //TODO
    }

    async getRecommendedOrders(userId: string) {
        //TODO
    }
}