import { Prisma, PrismaClient, Shop, ShopCategory, User } from "@prisma/client";
import { classInjection, injected } from "../util/injection-decorators";
import OSSService from "./oss.service";
import { ResponseError } from "../util/errors";
import ShopService from "./shop.service";
import { getShops, getItems, getOrders } from "@prisma/client/sql";
import OrderService from "./order.service";
import ItemService from "./item.service";

@classInjection
export default class RecommendedService {

    @injected
    private prisma!: PrismaClient

    @injected
    private ossService!: OSSService

    @injected
    private shopService!: ShopService

    @injected
    private itemService!: ItemService

    @injected
    private orderService!: OrderService


    async shopDataToRecommendedShopInfo(
        shop: Prisma.ShopGetPayload<{ include: { categories: true } }> & { distance: number },
        recommends: Prisma.ItemGetPayload<{ include: { categories: true } }>[]
    ) {
        return {
            ...await this.shopService.shopDataToFullShopInfo(shop),
            time: Math.round(shop.distance * 13),
            distance: shop.distance,
            recommends: await Promise.all(recommends.map(i => this.itemService.itemDataToFullItemInfo(i)))
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

            const address = addressId ? await tx.address.findUnique({ where: { id: addressId } }) : await tx.address.findFirst({ where: { isDefault: true } });
            if (!address) {
                throw new ResponseError(404, 'Address not found');
            }

            minRating ??= 0

            const date = new Date();
            const currentTime = date.getUTCMinutes() + date.getUTCHours() * 60;

            console.log(address, maxDistance, filterKeywords, categories, minRating, currentTime, sorting, pageLimit, pageSkip)

            const shops = await this.prisma.$queryRawTyped(getShops(
                address.latitude,
                address.longitude,
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
                    console.log(s)

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

    async getRecommendedItems(
        currentUserId: string,
        pageSkip: number,
        pageLimit: number,
        filterKeywords: string[],
        sorting: string,
        categories?: string[],
        maxDistance?: number,
        minRating?: number,
        maxTime?: number,
        addressId?: string,
        minPrice?: number,
        maxPrice?: number
    ) {
        return await this.prisma.$transaction(async tx => {
            const currentUser = await tx.user.findUnique({ where: { id: currentUserId } });
            if (!currentUser) {
                throw new ResponseError(403, 'Permission denied');
            }
            if (categories) {
                const matchedCategories = await tx.itemCategory.findMany({
                    where: { id: { in: categories } }
                });
                if (categories.length != matchedCategories.length) {
                    throw new ResponseError(404, 'Categories not found');
                }
            }
            categories ??= [];
            let maxDistanceFinal = maxDistance;
            if (maxTime) {
                const distanceByTime = maxTime / 13;
                maxDistanceFinal = maxDistance ? Math.min(maxDistance, distanceByTime) : distanceByTime;
            }
            maxDistanceFinal ??= 50;
            const address = addressId ? await tx.address.findUnique({ where: { id: addressId } }) : await tx.address.findFirst({ where: { isDefault: true } });
            if (!address) {
                throw new ResponseError(404, 'Address not found');
            }
            minRating ??= 0;
            const date = new Date();
            const currentTime = date.getUTCMinutes() + date.getUTCHours() * 60;
            const items = await this.prisma.$queryRawTyped(getItems(
                address.latitude,
                address.longitude,
                maxDistanceFinal,
                filterKeywords,
                categories,
                minRating,
                currentTime,
                sorting,
                pageLimit,
                pageSkip,
                minPrice ?? null,
                maxPrice ?? null
            ));
            return await Promise.all(
                items.map(async (item: any) => {
                    const fullItem = await tx.item.findUnique({
                        where: { id: item.id },
                        include: { categories: true }
                    });
                    return this.itemService.itemDataToFullItemInfo(fullItem!);
                })
            );
        });
    }

    async getRecommendedOrders(
        userId: string,
        latitude: number,
        longitude: number,
        pageSkip: number,
        pageLimit: number,
        maxDistance?: number, // d
        maxTime?: number,     // t (暂未实现时间过滤)
        minIncome?: number    // m
    ) {
        return await this.prisma.$transaction(async tx => {
            const currentUser = await tx.user.findUnique({ where: { id: userId } })
            if (!currentUser) throw new ResponseError(403, 'Permission denied')

            // TypedSQL 查询推荐订单，仿照 getItems/getShops
            const orders = await tx.$queryRawTyped(getOrders(
                latitude,
                longitude,
                maxDistance ?? null,
                minIncome ?? null,
                pageLimit,
                pageSkip
            ));

            // 格式化响应结构
            return await Promise.all(
                orders.map(async ({id}) => {
                    const order = await tx.order.findUnique({
                        where: { id },
                        include: { items: true }
                    });
                    return this.orderService.orderDataToOrderInfo(order!);
                })
            );
        })
    }
}