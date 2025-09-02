import { Context, ServiceSchema, Errors } from "moleculer";
import { PrismaClient, Prisma, OrderStatus } from "@prisma/client";
import Joi from "joi";
import { AuthMeta } from "../mixins/api-auth.mixin";
import haversineDistance from "haversine-distance";

// Joi schema for request validation
const getRecommendedShopsRequestSchema = Joi.object({
    p: Joi.number().integer().min(0).default(0).optional(),
    pn: Joi.number().integer().min(1).max(100).default(10).optional(),
    q: Joi.string().allow('').default('').optional(),
    c: Joi.array().items(Joi.string().uuid()).default([]).optional(),
    d: Joi.number().min(0).optional(),
    r: Joi.number().integer().min(0).max(50).optional(),
    t: Joi.number().integer().min(0).optional(),
    s: Joi.string().valid('c', 't', 'r').default('c').optional(),
    rc: Joi.number().integer().min(0).max(5).default(0).optional(),
    a: Joi.string().uuid().optional()
});

const getRecommendedItemsRequestSchema = Joi.object({
    p: Joi.number().integer().min(0).default(0).optional(),
    pn: Joi.number().integer().min(1).max(100).default(10).optional(),
    q: Joi.string().allow('').default('').optional(),
    r: Joi.number().integer().min(0).max(50).optional(),
    s: Joi.string().valid('c', 't', 'r', 's').default('c').optional(),
    a: Joi.string().uuid().optional(),
    min_p: Joi.number().min(0).optional(),
    max_p: Joi.number().min(0).optional()
});

const getRecommendedOrdersRequestSchema = Joi.object({
    p: Joi.number().integer().min(0).default(0).optional(),
    pn: Joi.number().integer().min(1).max(100).default(10).optional(),
    d: Joi.number().min(0).optional(),
    t: Joi.number().integer().min(0).optional(),
    lat: Joi.number().required(),
    lon: Joi.number().required(),
    m: Joi.number().min(0).optional()
});

interface GetRecommendedShopsRequest {
    p: number;
    pn: number;
    q: string;
    c: string[];
    d?: number;
    r?: number;
    t?: number;
    s: 'c' | 't' | 'r';
    rc: number;
    a?: string;
}

interface GetRecommendedItemsRequest {
    p: number;
    pn: number;
    q: string;
    r?: number;
    s: 'c' | 't' | 'r' | 's';
    a?: string;
    min_p?: number;
    max_p?: number;
}

interface GetRecommendedOrdersRequest {
    p: number;
    pn: number;
    d?: number;
    t?: number;
    lat: number;
    lon: number;
    m?: number;
}

interface ItemWithShopInfo {
    item: any;
    shop: any;
    distance: number;
}

interface OrderWithDistance {
    order: any;
    totalDistance: number;
    totalDeliveryTime: number;
}

interface ShopWithDistance {
    shop: any;
    distance: number;
    deliveryTime: number;
}

const RecommendedService: ServiceSchema = {
    name: "recommended",

    actions: {
        getRecommendedShops: {
            params: getRecommendedShopsRequestSchema as any,
            async handler(ctx: Context<GetRecommendedShopsRequest, AuthMeta>) {
                const { currentUserId } = ctx.meta;
                const { p, pn, q, c, d, r, t, s, rc, a } = ctx.params;

                // 1. 获取用户配送地址
                const userAddress = await ctx.call("address.getAddressByIdOrDefault", {
                    userId: currentUserId,
                    addressId: a
                }) as any;

                const userLat = userAddress.coordinate[1];
                const userLng = userAddress.coordinate[0];

                // 2. 构建搜索条件
                const whereConditions: Prisma.ShopWhereInput[] = [
                    { verified: true },    // 已验证
                    { opened: true }       // 已开业
                ];

                // 关键词搜索
                if (q && q.trim()) {
                    const keywords = q.split(' ').filter(keyword => keyword.length > 0);
                    whereConditions.push({
                        OR: keywords.map(keyword => ({
                            name: {
                                contains: keyword,
                                mode: 'insensitive' as Prisma.QueryMode
                            }
                        }))
                    });
                }

                // 店铺类型筛选
                if (c && c.length > 0) {
                    whereConditions.push({
                        categories: {
                            some: {
                                id: { in: c }
                            }
                        }
                    });
                }

                // 3. 使用边界框进行地理位置预筛选
                const maxDistance = d || 50; // 如果没有指定距离，默认50公里
                const boundingBox = this.calculateBoundingBox(userLat, userLng, maxDistance);
                
                whereConditions.push({
                    addressLatitude: {
                        gte: boundingBox.minLat,
                        lte: boundingBox.maxLat
                    },
                    addressLongitude: {
                        gte: boundingBox.minLng,
                        lte: boundingBox.maxLng
                    }
                });

                // 4. 查询店铺
                const shops = await (this.prisma as PrismaClient).shop.findMany({
                    where: { AND: whereConditions },
                    include: { categories: true }
                });

                // 5. 计算距离并筛选
                const shopsWithDistance: ShopWithDistance[] = [];

                for (const shop of shops) {
                    const distance = this.calculateDistance(
                        userLat, userLng,
                        shop.addressLatitude, shop.addressLongitude
                    );

                    // 距离筛选
                    if (d && distance > d) continue;
                    
                    // 店铺最大配送距离筛选
                    if (distance > shop.maximumDistance) continue;

                    // 营业时间筛选
                    if (!this.isShopCurrentlyOpen(shop.openTimeStart, shop.openTimeEnd)) continue;

                    // 评分筛选
                    if (r !== undefined && shop.rating < r) continue;

                    const deliveryTime = this.calculateDeliveryTime(distance);
                    
                    // 配送时间筛选
                    if (t !== undefined && deliveryTime > t) continue;

                    shopsWithDistance.push({
                        shop,
                        distance,
                        deliveryTime
                    });
                }

                // 6. 排序
                this.sortShops(shopsWithDistance, s);

                // 7. 分页
                const pageSkip = p * pn;
                const paginatedShops = shopsWithDistance.slice(pageSkip, pageSkip + pn);

                // 8. 构建最终结果
                const result = await Promise.all(
                    paginatedShops.map(async ({ shop, distance, deliveryTime }) => {
                        // 获取完整店铺信息
                        const fullShopInfo = await ctx.call("shop.get", { id: shop.id }) as any;
                        
                        // 获取推荐商品
                        const recommends = rc > 0 
                            ? await ctx.call("item.getTopSellingItemsByShop", { shopId: shop.id, limit: rc }) as any[]
                            : [];

                        return {
                            ...fullShopInfo,
                            time: deliveryTime,
                            distance: Math.round(distance * 100) / 100, // 保留2位小数
                            recommends
                        };
                    })
                );

                return result;
            }
        },

        getRecommendedItems: {
            params: getRecommendedItemsRequestSchema as any,
            async handler(ctx: Context<GetRecommendedItemsRequest, AuthMeta>) {
                const { currentUserId } = ctx.meta;
                const { p, pn, q, r, s, a, min_p, max_p } = ctx.params;

                // 1. 获取用户配送地址
                const userAddress = await ctx.call("address.getAddressByIdOrDefault", {
                    userId: currentUserId,
                    addressId: a
                }) as any;

                const userLat = userAddress.coordinate[1];
                const userLng = userAddress.coordinate[0];

                // 2. 构建商品查询条件
                const itemWhereConditions: Prisma.ItemWhereInput[] = [
                    { available: true },   // 已上架
                    { stockout: false }    // 有库存
                ];

                // 关键词搜索
                if (q && q.trim()) {
                    const keywords = q.split(' ').filter(keyword => keyword.length > 0);
                    itemWhereConditions.push({
                        OR: keywords.map(keyword => ({
                            name: {
                                contains: keyword,
                                mode: 'insensitive' as Prisma.QueryMode
                            }
                        }))
                    });
                }

                // 评分筛选
                if (r !== undefined) {
                    itemWhereConditions.push({ rating: { gte: r } });
                }

                // 价格筛选
                if (min_p !== undefined) {
                    itemWhereConditions.push({ price: { gte: min_p } });
                }
                if (max_p !== undefined) {
                    itemWhereConditions.push({ price: { lte: max_p } });
                }

                // 3. 查询商品
                const items = await (this.prisma as PrismaClient).item.findMany({
                    where: { AND: itemWhereConditions },
                    include: { itemItemCategories: true }
                });

                // 4. 获取商品的店铺信息并筛选
                const itemsWithShopInfo: ItemWithShopInfo[] = [];

                for (const item of items) {
                    try {
                        // 获取店铺信息
                        const shop = await (this.prisma as PrismaClient).shop.findUnique({
                            where: { id: item.shopId },
                            include: { categories: true }
                        });

                        if (!shop) continue;

                        // 店铺必须已验证且已开业
                        if (!shop.verified || !shop.opened) continue;

                        // 营业时间筛选
                        if (!this.isShopCurrentlyOpen(shop.openTimeStart, shop.openTimeEnd)) continue;

                        // 计算距离
                        const distance = this.calculateDistance(
                            userLat, userLng,
                            shop.addressLatitude, shop.addressLongitude
                        );

                        // 店铺最大配送距离筛选
                        if (distance > shop.maximumDistance) continue;

                        itemsWithShopInfo.push({
                            item,
                            shop,
                            distance
                        });
                    } catch (error) {
                        // 如果获取店铺信息失败，跳过这个商品
                        continue;
                    }
                }

                // 5. 排序
                this.sortItems(itemsWithShopInfo, s);

                // 6. 分页
                const pageSkip = p * pn;
                const paginatedItems = itemsWithShopInfo.slice(pageSkip, pageSkip + pn);

                // 7. 构建最终结果
                const result = await Promise.all(
                    paginatedItems.map(async ({ item }) => {
                        // 获取完整商品信息
                        return await ctx.call("item.get", { id: item.id });
                    })
                );

                return result;
            }
        },

        getRecommendedOrders: {
            params: getRecommendedOrdersRequestSchema as any,
            async handler(ctx: Context<GetRecommendedOrdersRequest, AuthMeta>) {
                const { currentUserId } = ctx.meta;
                const { p, pn, d, t, lat, lon, m } = ctx.params;

                // 1. 查询状态为PREPARED且未分配骑手的订单
                const orders = await (this.prisma as PrismaClient).order.findMany({
                    where: {
                        status: OrderStatus.PREPARED,
                        riderId: null  // 还没有分配骑手
                    },
                    include: {
                        items: true
                    },
                    orderBy: { createdAt: 'desc' }
                });

                // 2. 计算距离并筛选
                const ordersWithDistance: OrderWithDistance[] = [];

                for (const order of orders) {
                    // 计算骑手到店铺的距离
                    const riderToShopDistance = this.calculateDistance(
                        lat, lon,
                        order.shopLatitude, order.shopLongitude
                    );

                    // 计算店铺到顾客的距离
                    const shopToCustomerDistance = this.calculateDistance(
                        order.shopLatitude, order.shopLongitude,
                        order.customerLatitude, order.customerLongitude
                    );

                    // 总配送距离
                    const totalDistance = riderToShopDistance + shopToCustomerDistance;

                    // 距离筛选
                    if (d !== undefined && totalDistance > d) continue;

                    // 计算总配送时间
                    const totalDeliveryTime = this.calculateDeliveryTime(totalDistance);

                    // 配送时间筛选
                    if (t !== undefined && totalDeliveryTime > t) continue;

                    // 最低收入筛选
                    if (m !== undefined && order.deliveryFee < m) continue;

                    ordersWithDistance.push({
                        order,
                        totalDistance,
                        totalDeliveryTime
                    });
                }

                // 3. 按配送费降序排序（收入优先）
                ordersWithDistance.sort((a, b) => b.order.deliveryFee - a.order.deliveryFee);

                // 4. 分页
                const pageSkip = p * pn;
                const paginatedOrders = ordersWithDistance.slice(pageSkip, pageSkip + pn);

                // 5. 构建最终结果
                const result = await Promise.all(
                    paginatedOrders.map(async ({ order }) => {
                        // 使用order服务的方法来格式化订单数据
                        return await ctx.call("order.getOrderById", { id: order.id });
                    })
                );

                return result;
            }
        }
    },

    methods: {
        // 计算配送时间：距离(km) × 13
        calculateDeliveryTime(distanceKm: number): number {
            return Math.round(distanceKm * 13);
        },

        // 判断店铺是否在营业时间内（UTC时间）
        isShopCurrentlyOpen(openTimeStart: number, openTimeEnd: number): boolean {
            const now = new Date();
            const currentUtcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
            
            if (openTimeStart <= openTimeEnd) {
                // 不跨零点：如 08:00-22:00 (480-1320)
                return currentUtcMinutes >= openTimeStart && currentUtcMinutes <= openTimeEnd;
            } else {
                // 跨零点：如 22:00-08:00 (1320-480)
                return currentUtcMinutes >= openTimeStart || currentUtcMinutes <= openTimeEnd;
            }
        },

        // 计算两点间的haversine距离（公里）
        calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
            const point1 = { latitude: lat1, longitude: lng1 };
            const point2 = { latitude: lat2, longitude: lng2 };
            return haversineDistance(point1, point2) / 1000; // 转换为公里
        },

        // 根据中心点和最大距离计算经纬度边界框
        calculateBoundingBox(centerLat: number, centerLng: number, maxDistanceKm: number) {
            // 1度纬度 ≈ 111公里
            const latDelta = maxDistanceKm / 111;
            
            // 1度经度距离随纬度变化，在纬度lat处：1度经度 ≈ 111 * cos(lat) 公里
            const lngDelta = maxDistanceKm / (111 * Math.cos(centerLat * Math.PI / 180));
            
            return {
                minLat: centerLat - latDelta,
                maxLat: centerLat + latDelta,
                minLng: centerLng - lngDelta,
                maxLng: centerLng + lngDelta
            };
        },

        // 排序店铺
        sortShops(shopsWithDistance: ShopWithDistance[], sortBy: 'c' | 't' | 'r'): void {
            switch (sortBy) {
                case 'r':
                    // 按评分降序
                    shopsWithDistance.sort((a, b) => b.shop.rating - a.shop.rating);
                    break;
                case 't':
                    // 按距离升序
                    shopsWithDistance.sort((a, b) => a.distance - b.distance);
                    break;
                case 'c':
                default:
                    // 按综合算法：r * exp(-0.06 * d) 降序
                    shopsWithDistance.sort((a, b) => {
                        const scoreA = a.shop.rating * Math.exp(-0.06 * a.distance);
                        const scoreB = b.shop.rating * Math.exp(-0.06 * b.distance);
                        return scoreB - scoreA;
                    });
                    break;
            }
        },

        // 排序商品
        sortItems(itemsWithShopInfo: ItemWithShopInfo[], sortBy: 'c' | 't' | 'r' | 's'): void {
            switch (sortBy) {
                case 'r':
                    // 按商品评分降序
                    itemsWithShopInfo.sort((a, b) => b.item.rating - a.item.rating);
                    break;
                case 't':
                    // 按店铺距离升序
                    itemsWithShopInfo.sort((a, b) => a.distance - b.distance);
                    break;
                case 's':
                    // 按商品销量降序
                    itemsWithShopInfo.sort((a, b) => b.item.sale - a.item.sale);
                    break;
                case 'c':
                default:
                    // 按评分和销量综合排序：rating * 0.6 + sale * 0.4，降序
                    itemsWithShopInfo.sort((a, b) => {
                        const scoreA = a.item.rating * 0.6 + a.item.sale * 0.4;
                        const scoreB = b.item.rating * 0.6 + b.item.sale * 0.4;
                        return scoreB - scoreA;
                    });
                    break;
            }
        }
    },

    async created() {
        this.prisma = new PrismaClient();
    },

    async stopped() {
        await (this.prisma as PrismaClient).$disconnect();
    }
};

export default RecommendedService;
