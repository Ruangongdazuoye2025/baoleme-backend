import { Prisma, PrismaClient, Shop, ShopCategory, User } from "@prisma/client";
import { classInjection, injected } from "../util/injection-decorators";
import OSSService from "./oss.service";
import UserService from "./user.service";
import { ResponseError } from "../util/errors";
import ShopService from "./shop.service";
import OrderService from "./order.service";
import ItemService from "./item.service";
import AddressService from "./address.service";

@classInjection
export default class RecommendedService {

    @injected
    private prisma!: PrismaClient;

    @injected
    private ossService!: OSSService;

    @injected
    private userService!: UserService;

    @injected
    private shopService!: ShopService;

    @injected
    private itemService!: ItemService;

    @injected
    private orderService!: OrderService;

    @injected
    private addressService!: AddressService;

    /**
     * 获取用于推荐的地址信息
     * 使用 AddressService 来处理地址相关操作
     */
    private async getAddressForRecommendation(userId: string, addressId?: string) {
        if (addressId) {
            // 通过 AddressService 获取指定地址
            return await this.addressService.getAddressById(userId, addressId);
        } else {
            // 获取用户的默认地址
            const addresses = await this.addressService.getAddresses(userId);
            const defaultAddress = addresses.find(addr => addr.isDefault);
            if (!defaultAddress) {
                throw new ResponseError(404, 'No default address found');
            }
            return defaultAddress;
        }
    }


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
        // 通过 UserService 获取用户信息
        const currentUser = await this.userService.getUser(currentUserId);
        if (!currentUser) {
            throw new ResponseError(403, 'Permission denied');
        }

        // 验证分类存在（通过 ShopService）
        if (categories && categories.length > 0) {
            try {
                await Promise.all(categories.map(categoryId => 
                    this.shopService.getShopCategory(categoryId)
                ));
            } catch (error) {
                throw new ResponseError(404, 'Categories not found');
            }
        }
        categories ??= []

        // 处理时间到距离的转换
        if (maxTime) {
            const distanceByTime = maxTime / 13;
            maxDistance = maxDistance ? Math.min(maxDistance, distanceByTime) : distanceByTime;
        }
        maxDistance ??= 50;

        // 获取地址信息（通过 AddressService）
        const address = await this.getAddressForRecommendation(currentUserId, addressId);
        if (!address) {
            throw new ResponseError(404, 'Address not found');
        }

        // 验证地址坐标
        if (!address.coordinate[0] || !address.coordinate[1]) {
            throw new ResponseError(400, 'Address coordinates are required for recommendations');
        }

        minRating ??= 0

        // 实现推荐逻辑（从SQL移入服务代码）
        const recommendedShops = await this.getFilteredShopsWithRecommendations(
            address.coordinate[1], // latitude
            address.coordinate[0], // longitude
            maxDistance,
            filterKeywords,
            categories,
            minRating,
            sorting,
            pageLimit,
            pageSkip,
            hotItemCount
        );

        return recommendedShops;
    }

    /**
     * 实现店铺推荐逻辑（从SQL移入服务代码）
     */
    private async getFilteredShopsWithRecommendations(
        latitude: number,
        longitude: number,
        maxDistance: number,
        filterKeywords: string[],
        categories: string[],
        minRating: number,
        sorting: string,
        pageLimit: number,
        pageSkip: number,
        hotItemCount: number
    ) {
        // 验证分类存在
        if (categories.length > 0) {
            try {
                await Promise.all(categories.map(id => this.shopService.getShopCategory(id)));
            } catch (error) {
                throw new ResponseError(404, 'Categories not found');
            }
        }

        // 通过 ShopService 获取所有验证过的店铺
        // 注意：这里需要一个管理员用户ID来获取全局店铺
        const allShops = await this.shopService.getFilteredGlobalShops(
            'system', // 需要系统权限或管理员权限
            0, 
            1000, // 获取足够多的店铺进行过滤
            filterKeywords
        );

        const date = new Date();
        const currentTime = date.getUTCMinutes() + date.getUTCHours() * 60;

        // 实现推荐过滤逻辑
        const filteredShops = allShops.filter(shop => {
            // 距离过滤
            const distance = this.calculateDistance(latitude, longitude, shop.addressLatitude, shop.addressLongitude);
            if (distance > maxDistance) return false;

            // 评分过滤
            if (shop.rating < minRating) return false;

            // 分类过滤
            if (categories.length > 0) {
                const hasMatchingCategory = shop.categories.some(category => categories.includes(category.id));
                if (!hasMatchingCategory) return false;
            }

            // 营业时间过滤
            if (!shop.opened) return false;
            const openMinutes = shop.openTimeStart;
            const closeMinutes = shop.openTimeEnd;
            const isOpen = closeMinutes > openMinutes 
                ? currentTime >= openMinutes && currentTime < closeMinutes 
                : currentTime >= openMinutes || currentTime < closeMinutes;
            if (!isOpen) return false;

            return true;
        }).map(shop => ({
            ...shop,
            distance: this.calculateDistance(latitude, longitude, shop.addressLatitude, shop.addressLongitude)
        }));

        // 排序
        this.sortShops(filteredShops, sorting);

        // 分页
        const paginatedShops = filteredShops.slice(pageSkip, pageSkip + pageLimit);

        // 获取每个店铺的热门商品并构建推荐信息
        const recommendedShops = await Promise.all(paginatedShops.map(async shop => {
            // 通过 ItemService 获取店铺的商品
            try {
                const allItems = await this.itemService.getItems(
                    'system', // 使用系统权限
                    shop.id,
                    0,
                    100 // 先获取更多商品用于排序
                );
                
                // 按销量排序并取前几个
                const topItems = allItems
                    .sort((a, b) => (b.sale || 0) - (a.sale || 0))
                    .slice(0, hotItemCount);

                return this.shopDataToRecommendedShopInfo(
                    {
                        ...shop,
                        distance: shop.distance,
                        categories: shop.categories // 保持原有的分类结构
                    },
                    topItems
                );
            } catch (error) {
                // 如果获取商品失败，返回没有推荐商品的店铺信息
                return this.shopDataToRecommendedShopInfo(
                    {
                        ...shop,
                        distance: shop.distance,
                        categories: shop.categories
                    },
                    []
                );
            }
        }));

        return recommendedShops;
    }

    /**
     * 计算两点之间的距离（公里）
     */
    private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371; // 地球半径（公里）
        const dLat = this.deg2rad(lat2 - lat1);
        const dLon = this.deg2rad(lon2 - lon1);
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    private deg2rad(deg: number): number {
        return deg * (Math.PI/180);
    }

    /**
     * 店铺排序逻辑
     */
    private sortShops(shops: any[], sorting: string) {
        switch (sorting) {
            case 'distance':
                shops.sort((a, b) => a.distance - b.distance);
                break;
            case 'rating':
                shops.sort((a, b) => b.rating - a.rating);
                break;
            case 'sale':
                shops.sort((a, b) => (b.sale || 0) - (a.sale || 0));
                break;
            default:
                // 默认按距离排序
                shops.sort((a, b) => a.distance - b.distance);
        }
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
        // 通过 UserService 获取用户信息
        const currentUser = await this.userService.getUser(currentUserId);
        if (!currentUser) {
            throw new ResponseError(403, 'Permission denied');
        }

        // 验证商品分类存在（通过相关服务）
        if (categories && categories.length > 0) {
            // TODO: 需要创建 ItemCategoryService 或在 ItemService 中添加分类验证
            // 暂时跳过分类验证
        }
        categories ??= [];

        // 处理时间到距离的转换
        let maxDistanceFinal = maxDistance;
        if (maxTime) {
            const distanceByTime = maxTime / 13;
            maxDistanceFinal = maxDistance ? Math.min(maxDistance, distanceByTime) : distanceByTime;
        }
        maxDistanceFinal ??= 50;

        // 获取地址信息（通过 AddressService）
        const address = await this.getAddressForRecommendation(currentUserId, addressId);
        if (!address) {
            throw new ResponseError(404, 'Address not found');
        }

        // 验证地址坐标
        if (!address.coordinate[0] || !address.coordinate[1]) {
            throw new ResponseError(400, 'Address coordinates are required for recommendations');
        }

        minRating ??= 0;

        // 实现商品推荐逻辑
        const recommendedItems = await this.getFilteredItemsWithRecommendations(
            address.coordinate[1], // latitude
            address.coordinate[0], // longitude
            maxDistanceFinal,
            filterKeywords,
            categories,
            minRating,
            sorting,
            pageLimit,
            pageSkip,
            minPrice,
            maxPrice
        );

        return recommendedItems;
    }

    /**
     * 实现商品推荐逻辑（从SQL移入服务代码）
     */
    private async getFilteredItemsWithRecommendations(
        latitude: number,
        longitude: number,
        maxDistance: number,
        filterKeywords: string[],
        categories: string[],
        minRating: number,
        sorting: string,
        pageLimit: number,
        pageSkip: number,
        minPrice?: number,
        maxPrice?: number
    ) {
        const date = new Date();
        const currentTime = date.getUTCMinutes() + date.getUTCHours() * 60;

        // 获取所有验证过的店铺
        const allShops = await this.shopService.getFilteredGlobalShops(
            'system',
            0,
            1000, // 获取足够多的店铺
            []
        );

        // 过滤符合条件的店铺
        const validShops = allShops.filter(shop => {
            // 距离过滤
            const distance = this.calculateDistance(latitude, longitude, shop.addressLatitude, shop.addressLongitude);
            if (distance > maxDistance) return false;

            // 评分过滤
            if (shop.rating < minRating) return false;

            // 营业时间过滤
            if (!shop.opened) return false;
            const openMinutes = shop.openTimeStart;
            const closeMinutes = shop.openTimeEnd;
            const isOpen = closeMinutes > openMinutes 
                ? currentTime >= openMinutes && currentTime < closeMinutes 
                : currentTime >= openMinutes || currentTime < closeMinutes;
            if (!isOpen) return false;

            return true;
        });

        // 获取所有符合条件店铺的商品
        const allItems: any[] = [];
        for (const shop of validShops) {
            try {
                const shopItems = await this.itemService.getItems('system', shop.id, 0, 100);
                
                // 过滤商品
                const filteredItems = shopItems.filter(item => {
                    // 价格过滤
                    if (minPrice !== undefined && item.price < minPrice) return false;
                    if (maxPrice !== undefined && item.price > maxPrice) return false;

                    // 关键词过滤
                    if (filterKeywords.length > 0) {
                        const matchesKeyword = filterKeywords.some(keyword => 
                            item.name.toLowerCase().includes(keyword.toLowerCase()) ||
                            item.description?.toLowerCase().includes(keyword.toLowerCase())
                        );
                        if (!matchesKeyword) return false;
                    }

                    // 分类过滤
                    if (categories.length > 0) {
                        const hasMatchingCategory = item.categories?.some((category: any) => 
                            categories.includes(category.id)
                        );
                        if (!hasMatchingCategory) return false;
                    }

                    return true;
                });

                // 添加店铺距离信息
                const itemsWithDistance = filteredItems.map(item => ({
                    ...item,
                    shopDistance: this.calculateDistance(latitude, longitude, shop.addressLatitude, shop.addressLongitude)
                }));

                allItems.push(...itemsWithDistance);
            } catch (error) {
                // 跳过获取失败的店铺
                continue;
            }
        }

        // 排序
        this.sortItems(allItems, sorting);

        // 分页
        const paginatedItems = allItems.slice(pageSkip, pageSkip + pageLimit);

        // 转换为完整商品信息
        return await Promise.all(paginatedItems.map(async item => {
            return this.itemService.itemDataToFullItemInfo(item);
        }));
    }

    /**
     * 商品排序逻辑
     */
    private sortItems(items: any[], sorting: string) {
        switch (sorting) {
            case 'distance':
                items.sort((a, b) => a.shopDistance - b.shopDistance);
                break;
            case 'price_asc':
                items.sort((a, b) => a.price - b.price);
                break;
            case 'price_desc':
                items.sort((a, b) => b.price - a.price);
                break;
            case 'sale':
                items.sort((a, b) => (b.sale || 0) - (a.sale || 0));
                break;
            default:
                // 默认按距离排序
                items.sort((a, b) => a.shopDistance - b.shopDistance);
        }
    }

    async getRecommendedOrders(
        userId: string,
        latitude: number,
        longitude: number,
        pageSkip: number,
        pageLimit: number,
        maxDistance?: number, // d
        maxTime?: number,     // t (time filtering not implemented yet)
        minIncome?: number    // m
    ) {
        // 通过 UserService 获取用户信息
        const currentUser = await this.userService.getUser(userId)
        if (!currentUser) throw new ResponseError(403, 'Permission denied')

        // 实现订单推荐逻辑
        const recommendedOrders = await this.getFilteredOrdersWithRecommendations(
            latitude,
            longitude,
            maxDistance,
            minIncome,
            pageLimit,
            pageSkip
        );

        return recommendedOrders;
    }

    /**
     * 实现订单推荐逻辑（从SQL移入服务代码）
     */
    private async getFilteredOrdersWithRecommendations(
        latitude: number,
        longitude: number,
        maxDistance?: number,
        minIncome?: number,
        pageLimit?: number,
        pageSkip?: number
    ) {
        // 通过 OrderService 获取准备状态的订单
        // TODO: 需要在 OrderService 中添加获取特定状态订单的方法
        const preparedOrders = await this.orderService.getOrders(
            'system', // 使用系统权限
            0,
            1000, // 获取足够多的订单
            'prepared' as any
        );

        // 过滤订单
        const filteredOrders = preparedOrders.filter(order => {
            // 距离过滤
            if (maxDistance) {
                const distance = this.calculateDistance(
                    latitude, 
                    longitude, 
                    order.shopAddress.coordinate[1], 
                    order.shopAddress.coordinate[0]
                );
                if (distance > maxDistance) return false;
            }

            // 收入过滤
            if (minIncome && order.total < minIncome) return false;

            return true;
        });

        // 按距离排序（配送员通常优先选择近的订单）
        filteredOrders.sort((a, b) => {
            const distanceA = this.calculateDistance(latitude, longitude, a.shopAddress.coordinate[1], a.shopAddress.coordinate[0]);
            const distanceB = this.calculateDistance(latitude, longitude, b.shopAddress.coordinate[1], b.shopAddress.coordinate[0]);
            return distanceA - distanceB;
        });

        // 分页
        const skip = pageSkip || 0;
        const limit = pageLimit || 10;
        const paginatedOrders = filteredOrders.slice(skip, skip + limit);

        return paginatedOrders;
    }

    /**
     * 获取推荐所需的地址信息
     * TODO: 将来应该通过 AddressService 来处理
     */
}