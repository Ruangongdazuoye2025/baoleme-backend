import { Prisma, PrismaClient, Shop, ShopCategory, User } from "@prisma/client";
import { classInjection, injected } from "../util/injection-decorators";
import OSSService from "./oss.service";
import { CreateShop, UpdateShopProfile } from "../schema/shop.schema";
import { ResponseError } from "../util/errors";
import sharp from "sharp";

@classInjection
export default class ShopService {

    @injected
    private prisma!: PrismaClient

    @injected
    private ossService!: OSSService

    async getFilteredGlobalShops(currentUserId: string, pageSkip: number, pageLimit: number, filterKeywords: string[], minCreatedAt?: Date, maxCreatedAt?: Date) {
        return await this.prisma.$transaction(async tx => {
            const currentUser = await tx.user.findUnique({ where: { id: currentUserId } })
            if (!currentUser || currentUser.role !== 'ADMIN') {
                throw new ResponseError(403, 'Permission denied')
            }
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
            if (!await tx.user.findUnique({ where: { id: ownerId } })) {
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

    async createShop(userId: string, request: CreateShop) {
        const { name, description, categories, address, opened, openTimeStart, openTimeEnd, deliveryThreshold, deliveryPrice, maximumDistance } = request
        return await this.prisma.$transaction(async tx => {
            const user = await tx.user.findUnique({ where: { id: userId } })
            if (!user) {
                throw new ResponseError(401, 'Unauthorized')
            }
            await Promise.all(request.categories.map(async id => {
                const category = await tx.shopCategory.findUnique({ where: { id } })
                if (!category) {
                    throw new ResponseError(404, 'Shop category not found')
                }
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
                    addressLatitude: address.coordinate[0],
                    addressLongitude: address.coordinate[1],
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
        const shop = await this.prisma.shop.findUnique({
            where: { id },
            include: { categories: true }
        })
        if (!shop) {
            throw new ResponseError(404, 'Shop not found')
        }
        return shop
    }

    async deleteShop(currentUserId: string, id: string) {
        await this.prisma.$transaction(async tx => {
            const shop = await tx.shop.findUnique({ where: { id } })
            if (!shop) {
                throw new ResponseError(404, 'Shop not found')
            }
            const currentUser = await tx.user.findUnique({ where: { id: currentUserId } })
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
            const currentUser = await tx.user.findUnique({ where: { id: currentUserId } })
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
                    addressLatitude: address?.coordinate?.[0],
                    addressLongitude: address?.coordinate?.[1],
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

    readonly ossContentType = 'image/webp'

    async updateShopImage(currentUserId: string, id: string, cover: Buffer | undefined, detail: Buffer | undefined, license: Buffer | undefined) {
        await this.prisma.$transaction(async tx => {
            const shop = await tx.shop.findUnique({ where: { id } })
            if (!shop) {
                throw new ResponseError(404, 'Shop not found')
            }
            const currentUser = await tx.user.findUnique({ where: { id: currentUserId } })
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
            const currentUser = await tx.user.findUnique({ where: { id: currentUserId } })
            if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.id !== shop.ownerId)) {
                throw new ResponseError(403, 'Permission denied')
            }
            const owner = await tx.user.findUnique({ where: { id: ownerId } })
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
            const currentUser = await tx.user.findUnique({ where: { id: currentUserId } })
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
            const currentUser = await tx.user.findUnique({ where: { id: currentUserId } })
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
            const currentUser = await tx.user.findUnique({ where: { id: currentUserId } })
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
            const currentUser = await tx.user.findUnique({ where: { id: currentUserId } })
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

}