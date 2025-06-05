import { ItemCategory, PrismaClient } from "@prisma/client";
import { classInjection, injected } from "../util/injection-decorators";
import { ResponseError } from "../util/errors";

@classInjection
export default class ItemService {

    @injected
    private prisma!: PrismaClient

    itemCategoryDataToItemCategoryInfo(category: ItemCategory) {
        return {
            id: category.id,
            name: category.name,
        }
    }

    async getItemCategories(shopId: string) {
        const shop = await this.prisma.shop.findUnique({
            where: { id: shopId },
            include: {
                itemCategories: {
                    orderBy: { order: 'asc' },
                },
            },
        })
        if (!shop) {
            throw new ResponseError(404, 'Shop not found')
        }
        return shop.itemCategories
    }

    async addItemCategory(currentUserId: string, shopId: string, name: string) {
        return await this.prisma.$transaction(async tx => {
            const currentUser = await tx.user.findUnique({
                where: { id: currentUserId },
            })
            const shop = await tx.shop.findUnique({
                where: { id: shopId },
            })
            if (!shop) {
                throw new ResponseError(404, 'Shop not found')
            }
            if (!currentUser || (currentUser.id !== shop.ownerId && currentUser.role !== 'ADMIN')) {
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

    async updateItemCategory(currentUserId: string, shopId: string, categoryId: string, name: string) {
        return await this.prisma.$transaction(async tx => {
            const currentUser = await tx.user.findUnique({
                where: { id: currentUserId },
            })
            const shop = await tx.shop.findUnique({
                where: { id: shopId },
            })
            if (!shop) {
                throw new ResponseError(404, 'Shop not found')
            }
            if (!currentUser || (currentUser.id !== shop.ownerId && currentUser.role !== 'ADMIN')) {
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

    async updateItemCategoryPos(currentUserId: string, shopId: string, categoryId: string, before: string | null) {
        await this.prisma.$transaction(async tx => {
            const currentUser = await tx.user.findUnique({ where: { id: currentUserId } })
            const shop = await tx.shop.findUnique({ where: { id: shopId } })
            if (!shop) {
                throw new ResponseError(404, 'Shop not found')
            }
            if (!currentUser || (currentUser.id !== shop.ownerId && currentUser.role !== 'ADMIN')) {
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

    async deleteItemCategory(currentUserId: string, shopId: string, categoryId: string) {
        return await this.prisma.$transaction(async tx => {
            const currentUser = await tx.user.findUnique({
                where: { id: currentUserId },
            })
            const shop = await tx.shop.findUnique({
                where: { id: shopId },
            })
            if (!shop) {
                throw new ResponseError(404, 'Shop not found')
            }
            if (!currentUser || (currentUser.id !== shop.ownerId && currentUser.role !== 'ADMIN')) {
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
            await tx.itemCategory.delete({
                where: { id: categoryId },
            })
        })
    }
}