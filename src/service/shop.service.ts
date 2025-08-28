import { Prisma, PrismaClient, Shop, ShopCategory, User, UserRole } from "@prisma/client";
import { classInjection, injected } from "../util/injection-decorators";
import OSSService from "./oss.service";
import UserService from "./user.service";
import { CreateShop, UpdateShopProfile } from "../schema/shop.schema";
import { ResponseError } from "../util/errors";
import { BaseServiceUtils } from "./base.service";
import { FILE_CONSTANTS, HTTP_STATUS } from "../constants/app.constants";
import sharp from "sharp";

interface CategoryValidationResult {
    isValid: boolean;
    onlyAvailable: boolean;
    errorCode?: number;
    errorMessage?: string;
}

@classInjection
export default class ShopService {

    @injected
    protected declare prisma: PrismaClient

    @injected
    private ossService!: OSSService

    @injected
    private userService!: UserService

    private readonly ossContentType = FILE_CONSTANTS.IMAGE_CONTENT_TYPE

    async getFilteredGlobalShops(currentUserId: string, pageSkip: number, pageLimit: number, filterKeywords: string[], minCreatedAt?: Date, maxCreatedAt?: Date) {
        return await this.prisma.$transaction(async tx => {
            await BaseServiceUtils.checkUserPermission(this.prisma, currentUserId, currentUserId, [UserRole.ADMIN], false)
            
            return await tx.shop.findMany({
                include: { categories: true },
                where: {
                    AND: [
                        {
                            OR: filterKeywords.map(keyword => ({
                                name: {
                                    contains: keyword,
                                    mode: 'insensitive' as Prisma.QueryMode
                                }
                            }))
                        },
                        { createdAt: { gte: minCreatedAt } },
                        { createdAt: { lte: maxCreatedAt } }
                    ]
                },
                skip: pageSkip,
                take: pageLimit,
                orderBy: { createdAt: 'desc' },
            })
        })
    }

    async getShopsByOwnerId(ownerId: string) {
        return await this.prisma.$transaction(async tx => {
            // 通过 UserService 验证用户存在
            const user = await this.userService.getUser(ownerId)
            if (!user) {
                throw new ResponseError(404, 'User not found')
            }
            
            return await tx.shop.findMany({
                include: { categories: true },
                where: { ownerId },
                orderBy: { createdAt: 'desc' },
            })
        })
    }

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
        }
    }

    async createShop(userId: string, request: CreateShop) {
        const { name, description, categories, address, opened, openTimeStart, openTimeEnd, deliveryThreshold, deliveryPrice, maximumDistance } = request
        return await this.prisma.$transaction(async tx => {
            // 通过 UserService 验证用户存在
            const user = await this.userService.getUser(userId)
            if (!user) {
                throw new ResponseError(404, 'User not found')
            }
            
            // Validate categories exist
            await Promise.all(request.categories.map(async id => {
                await BaseServiceUtils.findByIdOrThrow(
                    () => tx.shopCategory.findUnique({ where: { id } }),
                    'Shop category not found'
                )
            }))
            
            return await tx.shop.create({
                data: {
                    name,
                    description,
                    ownerId: userId,
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
            })
        })
    }

    async getShop(id: string) {
        return await BaseServiceUtils.findByIdOrThrow(
            () => this.prisma.shop.findUnique({
                where: { id },
                include: { categories: true }
            }),
            'Shop not found'
        )
    }

    async deleteShop(currentUserId: string, id: string) {
        await this.prisma.$transaction(async tx => {
            const shop = await tx.shop.findUnique({ where: { id } })
            if (!shop) {
                throw new ResponseError(404, 'Shop not found')
            }
            // 通过 UserService 获取用户信息
            const currentUser = await this.userService.getUser(currentUserId)
            if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.id !== shop.ownerId)) {
                throw new ResponseError(403, 'Permission denied')
            }
            if (/* TODO check if the shop has any unfinished orders) */ false) {
                throw new ResponseError(409, 'Shop status conflicts')
            }
            await tx.shop.delete({ where: { id } })
            await Promise.all([
                this.ossService.removeObject(`shops/${id}/cover.webp`),
                this.ossService.removeObject(`shops/${id}/cover-thumbnail.webp`),
                this.ossService.removeObject(`shops/${id}/detail.webp`),
                this.ossService.removeObject(`shops/${id}/detail-thumbnail.webp`),
                this.ossService.removeObject(`shops/${id}/license.webp`),
                this.ossService.removeObject(`shops/${id}/license-thumbnail.webp`),
            ])
        })
    }

    async updateShopProfile(currentUserId: string, id: string, request: UpdateShopProfile) {
        const { name, description, categories, address, opened, openTimeStart, openTimeEnd, deliveryThreshold, deliveryPrice, maximumDistance } = request
        let verified: boolean | undefined = request.verified
        return await this.prisma.$transaction(async tx => {
            const shop = await tx.shop.findUnique({ where: { id } })
            if (!shop) {
                throw new ResponseError(404, 'Shop not found')
            }
            // 通过 UserService 获取用户信息
            const currentUser = await this.userService.getUser(currentUserId)
            if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.id !== shop.ownerId)) {
                throw new ResponseError(403, 'Permission denied')
            }
            if (categories) {
                await Promise.all(categories.map(async id => {
                    const category = await tx.shopCategory.findUnique({ where: { id } })
                    if (!category) {
                        throw new ResponseError(404, 'Shop category not found')
                    }
                }))
            }
            if (currentUser.role !== 'ADMIN') {
                verified = undefined
            }
            return await tx.shop.update({
                where: { id },
                data: {
                    name,
                    description,
                    categories: { set: categories?.map(id => ({ id })) },
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
                    openTimeStart,
                    openTimeEnd,
                    deliveryThreshold,
                    deliveryPrice,
                    maximumDistance
                },
                include: { categories: true }
            })
        })
    }

    async updateShopImage(currentUserId: string, id: string, cover: Buffer | undefined, detail: Buffer | undefined, license: Buffer | undefined) {
        await this.prisma.$transaction(async tx => {
            const shop = await tx.shop.findUnique({ where: { id } })
            if (!shop) {
                throw new ResponseError(404, 'Shop not found')
            }
            // 通过 UserService 获取用户信息
            const currentUser = await this.userService.getUser(currentUserId)
            if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.id !== shop.ownerId)) {
                throw new ResponseError(403, 'Permission denied')
            }
        })
        const tasks = []
        if (cover) {
            tasks.push(
                this.ossService.putObject(`shops/${id}/cover.webp`, sharp(cover).toFormat('webp'), this.ossContentType),
                this.ossService.putObject(`shops/${id}/cover-thumbnail.webp`, sharp(cover).resize(128, 128, { fit: 'outside' }).toFormat('webp'), this.ossContentType))
        }
        if (detail) {
            tasks.push(
                this.ossService.putObject(`shops/${id}/detail.webp`, sharp(detail).toFormat('webp'), this.ossContentType),
                this.ossService.putObject(`shops/${id}/detail-thumbnail.webp`, sharp(detail).resize(128, 128, { fit: 'outside' }).toFormat('webp'), this.ossContentType))
        }
        if (license) {
            tasks.push(
                this.ossService.putObject(`shops/${id}/license.webp`, sharp(license).toFormat('webp'), this.ossContentType),
                this.ossService.putObject(`shops/${id}/license-thumbnail.webp`, sharp(license).resize(128, 128, { fit: 'outside' }).toFormat('webp'), this.ossContentType))
        }
        await Promise.all(tasks)
    }

    async updateShopOwner(currentUserId: string, id: string, ownerId: string) {
        await this.prisma.$transaction(async tx => {
            const shop = await tx.shop.findUnique({ where: { id } })
            if (!shop) {
                throw new ResponseError(404, 'Shop not found')
            }
            // 通过 UserService 获取用户信息
            const currentUser = await this.userService.getUser(currentUserId)
            if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.id !== shop.ownerId)) {
                throw new ResponseError(403, 'Permission denied')
            }
            // 通过 UserService 验证新拥有者存在
            const owner = await this.userService.getUser(ownerId)
            if (!owner) {
                throw new ResponseError(404, 'User not found')
            }
            await tx.shop.update({
                where: { id },
                data: { ownerId }
            })
        })
    }

    shopCategoryDataToShopCategoryInfo(shopCategory: ShopCategory) {
        return {
            id: shopCategory.id,
            name: shopCategory.name,
        }
    }

    async getShopCategories() {
        return await this.prisma.shopCategory.findMany({
            orderBy: { order: 'asc' }
        })
    }

    async addShopCategory(currentUserId: string, name: string) {
        return await this.prisma.$transaction(async tx => {
            // 通过 UserService 获取用户信息
            const currentUser = await this.userService.getUser(currentUserId)
            if (!currentUser || currentUser.role !== 'ADMIN') {
                throw new ResponseError(403, 'Permission denied')
            }
            const maxOrder = (await tx.shopCategory.aggregate({
                _max: { order: true }
            }))._max.order ?? -1
            return await tx.shopCategory.create({
                data: {
                    name,
                    order: maxOrder + 1
                }
            })
        })
    }

    async getShopCategory(id: string) {
        const category = await this.prisma.shopCategory.findUnique({
            where: { id }
        })
        if (!category) {
            throw new ResponseError(404, 'Shop category not found')
        }
        return category
    }

    async updateShopCategory(currentUserId: string, id: string, name: string) {
        return await this.prisma.$transaction(async tx => {
            // 通过 UserService 获取用户信息
            const currentUser = await this.userService.getUser(currentUserId)
            if (!currentUser || currentUser.role !== 'ADMIN') {
                throw new ResponseError(403, 'Permission denied')
            }
            const category = await tx.shopCategory.findUnique({ where: { id } })
            if (!category) {
                throw new ResponseError(404, 'Shop category not found')
            }
            return await tx.shopCategory.update({
                where: { id },
                data: { name }
            })
        })
    }

    async updateShopCategoryPos(currentUserId: string, id: string, before: string | null) {
        await this.prisma.$transaction(async tx => {
            // 通过 UserService 获取用户信息
            const currentUser = await this.userService.getUser(currentUserId)
            if (!currentUser || currentUser.role !== 'ADMIN') {
                throw new ResponseError(403, 'Permission denied')
            }
            const category = await tx.shopCategory.findUnique({ where: { id } })
            if (!category) {
                throw new ResponseError(404, 'Shop category not found')
            }
            if (before) {
                const beforeCategory = await tx.shopCategory.findUnique({ where: { id: before } })
                if (!beforeCategory) {
                    throw new ResponseError(404, 'Shop category not found')
                }
                if (category.order === beforeCategory.order) {
                    return
                }
                if (category.order < beforeCategory.order) {
                    await tx.shopCategory.updateMany({
                        where: {
                            order: { gt: category.order, lt: beforeCategory.order }
                        },
                        data: { order: { increment: -1 } }
                    })
                    await tx.shopCategory.update({
                        where: { id },
                        data: { order: beforeCategory.order - 1 }
                    })
                } else {
                    await tx.shopCategory.updateMany({
                        where: {
                            order: { lt: category.order, gte: beforeCategory.order }
                        },
                        data: { order: { increment: 1 } }
                    })
                    await tx.shopCategory.update({
                        where: { id },
                        data: { order: beforeCategory.order }
                    })
                }
            } else {
                const maxOrder = (await tx.shopCategory.aggregate({
                    _max: { order: true }
                }))._max.order!
                await tx.shopCategory.updateMany({
                    where: {
                        order: { gt: category.order }
                    },
                    data: { order: { increment: -1 } }
                })
                await tx.shopCategory.update({
                    where: { id },
                    data: { order: maxOrder }
                })
            }
        })
    }

    async deleteShopCategory(currentUserId: string, id: string) {
        await this.prisma.$transaction(async tx => {
            // 通过 UserService 获取用户信息
            const currentUser = await this.userService.getUser(currentUserId)
            if (!currentUser || currentUser.role !== 'ADMIN') {
                throw new ResponseError(403, 'Permission denied')
            }
            const category = await tx.shopCategory.findUnique({ where: { id } })
            if (!category) {
                throw new ResponseError(404, 'Shop category not found')
            }
            await tx.shopCategory.delete({ where: { id } })
        })
    }

    /**
     * 更新店铺销量 - 供其他服务调用
     */
    async updateShopSale(shopId: string, saleCount: number) {
        return await this.prisma.shop.update({
            where: { id: shopId },
            data: { sale: saleCount }
        })
    }

    // 为 ReviewService 提供的接口
    async updateShopRating(shopId: string, rating: number) {
        return await this.prisma.shop.update({
            where: { id: shopId },
            data: { rating }
        })
    }

    /**
     * 获取指定商铺的所有商品分类
     * @param shopId 商铺ID
     * @returns 商品分类列表，按照排序字段升序排列
     * @throws ResponseError 当商铺不存在时抛出404错误
     */
    async getItemCategories(shopId: string) {
        const shop = await BaseServiceUtils.findByIdOrThrow(
            () => this.prisma.shop.findUnique({
                where: { id: shopId },
                include: {
                    itemCategories: {
                        orderBy: { order: 'asc' },
                    },
                },
            }),
            'Shop not found'
        )
        return shop.itemCategories
    }

    /**
     * 添加新的商品分类
     * @param currentUserId 当前操作用户的ID
     * @param shopId 商铺ID
     * @param name 分类名称
     * @returns 新创建的商品分类信息
     * @throws ResponseError 
     *         - 401: 用户未认证
     *         - 403: 用户无权限（非店主或管理员）
     *         - 404: 商铺不存在
     */
    async addItemCategory(currentUserId: string, shopId: string, name: string) {
        return await this.prisma.$transaction(async tx => {
            // 通过 UserService 获取用户信息
            const currentUser = await this.userService.getUser(currentUserId)
            if (!currentUser) {
                throw new ResponseError(401, 'Unauthorized')
            }
            
            const shop = await BaseServiceUtils.findByIdOrThrow(
                () => tx.shop.findUnique({ where: { id: shopId } }),
                'Shop not found'
            )
            
            if (currentUser.id !== shop.ownerId && currentUser.role !== UserRole.ADMIN) {
                throw new ResponseError(403, 'Permission denied')
            }
            
            const maxOrder = (await tx.itemCategory.aggregate({
                where: { shopId },
                _max: { order: true },
            }))._max.order ?? -1
            
            return await tx.itemCategory.create({
                data: {
                    name,
                    shopId,
                    order: maxOrder + 1,
                },
            })
        })
    }

    /**
     * 获取商品分类详情
     * @param shopId 商铺ID
     * @param categoryId 分类ID
     * @returns 商品分类信息
     * @throws ResponseError 
     *         - 404: 商铺不存在或分类不存在
     */
    async getItemCategory(shopId: string, categoryId: string) {
        return await this.prisma.$transaction(async tx => {
            const shop = await tx.shop.findUnique({
                where: { id: shopId },
            })
            if (!shop) {
                throw new ResponseError(404, 'Shop not found')
            }
            const category = await tx.itemCategory.findUnique({
                where: {
                    id: categoryId,
                    shopId: shop.id,
                },
            })
            if (!category) {
                throw new ResponseError(404, 'Item category not found')
            }
            return category
        })
    }

    /**
     * 更新商品分类信息
     * @param currentUserId 当前操作用户ID
     * @param shopId 商铺ID
     * @param categoryId 分类ID
     * @param name 新的分类名称
     * @throws ResponseError
     *         - 401: 用户未认证
     *         - 403: 用户无权限（非店主或管理员）
     *         - 404: 商铺不存在或分类不存在
     */
    async updateItemCategory(currentUserId: string, shopId: string, categoryId: string, name: string) {
        return await this.prisma.$transaction(async tx => {
            // 通过 UserService 获取用户信息
            const currentUser = await this.userService.getUser(currentUserId)
            if (!currentUser) {
                throw new ResponseError(401, 'Unauthorized')
            }
            
            const shop = await tx.shop.findUnique({
                where: { id: shopId },
            })
            if (!shop) {
                throw new ResponseError(404, 'Shop not found')
            }
            if (currentUser.id !== shop.ownerId && currentUser.role !== 'ADMIN') {
                throw new ResponseError(403, 'Permission denied')
            }
            const category = await tx.itemCategory.findUnique({
                where: {
                    id: categoryId,
                    shopId: shop.id,
                },
            })
            if (!category) {
                throw new ResponseError(404, 'Item category not found')
            }
            return await tx.itemCategory.update({
                where: { id: categoryId },
                data: { name },
            })
        })
    }

    /**
     * 更新商品分类的排序位置
     * @param currentUserId 当前操作用户ID
     * @param shopId 商铺ID
     * @param categoryId 要移动的分类ID
     * @param before 目标位置前面的分类ID，如果为null则移动到最后
     */
    async updateItemCategoryPos(currentUserId: string, shopId: string, categoryId: string, before: string | null) {
        await this.prisma.$transaction(async tx => {
            // 通过 UserService 获取用户信息
            const currentUser = await this.userService.getUser(currentUserId)
            if (!currentUser) {
                throw new ResponseError(401, 'Unauthorized')
            }
            
            const shop = await tx.shop.findUnique({ where: { id: shopId } })
            if (!shop) {
                throw new ResponseError(404, 'Shop not found')
            }
            if (currentUser.id !== shop.ownerId && currentUser.role !== 'ADMIN') {
                throw new ResponseError(403, 'Permission denied')
            }
            const category = await tx.itemCategory.findUnique({ 
                where: {
                    id: categoryId,
                    shopId: shop.id,
                } 
            })
            if (!category) {
                throw new ResponseError(404, 'Item category not found')
            }
            if (before) {
                const beforeCategory = await tx.itemCategory.findUnique({ where: { id: before } })
                if (!beforeCategory || beforeCategory.shopId !== shopId) {
                    throw new ResponseError(404, 'Item category not found')
                }
                if (category.order === beforeCategory.order) {
                    return
                }
                if (category.order < beforeCategory.order) {
                    await tx.itemCategory.updateMany({
                        where: {
                            shopId,
                            order: { gt: category.order, lt: beforeCategory.order }
                        },
                        data: { order: { decrement: 1 } }
                    })
                    await tx.itemCategory.update({
                        where: { id: categoryId },
                        data: { order: beforeCategory.order - 1 }
                    })
                } else {
                    await tx.itemCategory.updateMany({
                        where: {
                            shopId,
                            order: { lt: category.order, gte: beforeCategory.order }
                        },
                        data: { order: { increment: 1 } }
                    })
                    await tx.itemCategory.update({
                        where: { id: categoryId },
                        data: { order: beforeCategory.order }
                    })
                }
            } else {
                const maxOrder = (await tx.itemCategory.aggregate({
                    where: { shopId },
                    _max: { order: true }
                }))._max.order!
                await tx.itemCategory.updateMany({
                    where: {
                        shopId,
                        order: { gt: category.order }
                    },
                    data: { order: { decrement: 1 } }
                })
                await tx.itemCategory.update({
                    where: { id: categoryId },
                    data: { order: maxOrder }
                })
            }
        })
    }

    /**
     * 删除商品分类
     * @param currentUserId 当前操作用户ID
     * @param shopId 商铺ID
     * @param categoryId 要删除的分类ID
     * @throws ResponseError
     *         - 401: 用户未认证
     *         - 403: 用户无权限（非店主或管理员）
     *         - 404: 商铺不存在或分类不存在
     * @description
     * 使用事务实现层叠删除：
     * 1. 先删除所有与该分类关联的商品分类关系
     * 2. 更新其他分类的排序顺序
     * 3. 最后删除分类本身
     */
    async deleteItemCategory(currentUserId: string, shopId: string, categoryId: string) {
        return await this.prisma.$transaction(async tx => {
            // 通过 UserService 获取用户信息
            const currentUser = await this.userService.getUser(currentUserId)
            if (!currentUser) {
                throw new ResponseError(401, 'Unauthorized')
            }
            
            const shop = await tx.shop.findUnique({
                where: { id: shopId },
            })
            if (!shop) {
                throw new ResponseError(404, 'Shop not found')
            }
            if (currentUser.id !== shop.ownerId && currentUser.role !== 'ADMIN') {
                throw new ResponseError(403, 'Permission denied')
            }

            const category = await tx.itemCategory.findUnique({
                where: {
                    id: categoryId,
                    shopId: shop.id,
                },
            })
            if (!category) {
                throw new ResponseError(404, 'Item category not found')
            }

            // 3. 删除分类本身
            await tx.itemCategory.delete({
                where: { id: categoryId },
            })
        })
    }
}