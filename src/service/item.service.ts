import { Item, ItemCategory, Prisma, PrismaClient } from "@prisma/client";
import { classInjection, injected } from "../util/injection-decorators";
import { ResponseError } from "../util/errors";
import { CreateItem, UpdateItemProfile } from '../schema/item.schema'
import OSSService from "./oss.service";
import sharp from "sharp";

@classInjection
export default class ItemService {

    @injected
    private prisma!: PrismaClient

    @injected
    private ossService!: OSSService

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

    async getItemImageLinks(itemId: string) {
        const [coverOrigin, coverThumbnail] = await Promise.all([
            this.ossService.getObjectUrl(`items/${itemId}/cover.webp`),
            this.ossService.getObjectUrl(`items/${itemId}/cover-thumbnail.webp`),
        ])
        return {
            cover: { origin: coverOrigin, thumbnail: coverThumbnail }
        }
    }
    readonly ossContentType = 'image/webp'

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

    async getShopCategoryItems(currentUserId:string,shopId:string,categoryId:string,pageSkip:number,pageLimit:number){
        return await this.prisma.$transaction(async tx => {
            const shop = await tx.shop.findUnique({ where: { id: shopId } });
            if (!shop) {
                throw new ResponseError(404, 'Shop not found');
            }
            const category = await tx.itemCategory.findUnique({
                where: {
                id: categoryId,
                shopId: shopId
            }
        });
        if (!category) {
            throw new ResponseError(404, 'Item category not found in this shop');
        }
        const user = await tx.user.findUnique({
            where: { id: currentUserId }
        })
        if (!user) {
            throw new ResponseError(401, 'Unauthorized');
        }
        const onlyAvailable = user.role !== 'ADMIN' && user.id !== shop.ownerId;

        return await tx.item.findMany({
            where: {
                shopId: shopId,
                categories: {
                    some: {
                        id: categoryId
                    }
                },
                available: onlyAvailable ? true : undefined
            },
            include: {
                categories: true,
                shop: true
            },
            skip: pageSkip,
            take: pageLimit,
            orderBy: { createdAt: 'desc' }
        });
    });
    }
    async getItems(currentUserId:string,shopId:string,pageSkip:number,pageLimit:number){
        return await this.prisma.$transaction(async tx => {
            const shop = await tx.shop.findUnique({ where: { id: shopId } })
            if (!shop) {
                throw new ResponseError(404, 'Shop not found')
            }
            const user = await tx.user.findUnique({
                where: { id: currentUserId }
            })
            if (!user) {
                throw new ResponseError(401, 'Unauthorized');
            }
            const onlyAvailable = user.role !== 'ADMIN' && user.id !== shop.ownerId;
            return await tx.item.findMany({
                include:{categories: true, shop: true},
                where: { 
                    shopId: shopId,
                    available: onlyAvailable ? true : undefined
                },
                skip: pageSkip,
                take: pageLimit,
                orderBy: { createdAt: 'desc' }
            })
        })        
    }

    async getItem(currentUserId:string,id: string) {
        const item = await this.prisma.item.findUnique({
            where: { id },
            include: { categories: true, shop: true }
        })
        if (!item) {
            throw new ResponseError(404, 'Item not found')
        }
        const currentUser = await this.prisma.user.findUnique({ where: { id: currentUserId } })
        if (!currentUser) {
            throw new ResponseError(401, 'Unauthorized')
        }
        const onlyAvailable = currentUser.role !== 'ADMIN' && currentUser.id !== item.shop.ownerId;
        if (onlyAvailable && !item.available) {
            throw new ResponseError(404, 'Item not found')
        }
        return item
    }


    async createItem(userId: string,shopId:string,request: CreateItem){
        const { name, description, available, stockout, price, priceWithoutPromotion, categories} = request
        return await this.prisma.$transaction(async tx => {
            const user = await tx.user.findUnique({
                where: { id: userId }
            })
            if (!user) {
                throw new ResponseError(401, 'Unauthorized')
            }
            
            const shop = await tx.shop.findUnique({
                where: { id: shopId }
            })
            
            if (!shop) {
                throw new ResponseError(404, 'Shop not found')
            }
            
            if (shop.ownerId !== userId) {
                throw new ResponseError(403, 'Permission denied')
            }
            
            await Promise.all(request.categories.map(async id => {
                const category = await tx.itemCategory.findUnique({ 
                    where: { 
                        id,
                        shopId
                    } 
                })
                if (!category) {
                    throw new ResponseError(404, 'Item category not found')
                }
            }))
            
            const item = await tx.item.create({
                data: {
                    name,
                    description,
                    available,
                    stockout,
                    price,
                    priceWithoutPromotion,
                    shopId,
                    categories: { connect: categories.map(id => ({ id })) }
                },
                include: { categories: true, shop: true }
            })
            return item
        })
    }

    async updateItemProfile(userId: string, id: string, request:UpdateItemProfile){
        const { name, description, available, stockout, price, priceWithoutPromotion, categories } = request
        return await this.prisma.$transaction(async tx => {
            const item = await tx.item.findUnique({ 
                where: { id },
                include: { shop: true }
            })
            if (!item) {
                throw new ResponseError(404, 'Item not found')
            }
            const currentUser = await tx.user.findUnique({ where: { id: userId } })
            if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.id !== item.shop.ownerId)) {
                throw new ResponseError(403, 'Permission denied')
            }
            
            if (categories) {
                await Promise.all(categories.map(async id => {
                    const category = await tx.itemCategory.findUnique({ 
                        where: { 
                            id,
                            shopId: item.shopId
                        } 
                    })
                    if (!category) {
                        throw new ResponseError(404, 'Item category not found')
                    }
                }))
            }

            const updatedItem = await tx.item.update({
                where: { id },
                data: {
                    name,
                    description,
                    available,
                    stockout,
                    price,
                    priceWithoutPromotion,
                    categories: categories ? { set: categories.map(id => ({ id })) } : undefined
                },
                include: { categories: true, shop: true }
            })
            return updatedItem
        })
    }
    async updateItemImage(currentUserId: string, id: string, cover: Buffer | undefined) {
        await this.prisma.$transaction(async tx => {
            const item = await tx.item.findUnique({ 
                where: { id },
                include: { shop: true }
            })
            if (!item) {
                throw new ResponseError(404, 'Item not found')
            }
            const currentUser = await tx.user.findUnique({ where: { id: currentUserId } })
            if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.id !== item.shop.ownerId)) {
                throw new ResponseError(403, 'Permission denied')
            }
        })
        const tasks = []
        if (cover) {
            tasks.push(
                this.ossService.putObject(`items/${id}/cover.webp`, sharp(cover).toFormat('webp'), this.ossContentType),
                this.ossService.putObject(`items/${id}/cover-thumbnail.webp`, sharp(cover).resize(128, 128, { fit: 'outside' }).toFormat('webp'), this.ossContentType))
        }
        await Promise.all(tasks)
    }
    async deleteItem(currentUserId: string, id: string) {
        await this.prisma.$transaction(async tx => {
            const item = await tx.item.findUnique({ 
                where: { id },
                include: { shop: true }
            })
            if (!item) {
                throw new ResponseError(404, 'Item not found')
            }
            const currentUser = await tx.user.findUnique({ where: { id: currentUserId } })
            if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.id !== item.shop.ownerId)) {
                throw new ResponseError(403, 'Permission denied')
            }
            
            await tx.item.delete({ where: { id } })
            await Promise.all([
                this.ossService.removeObject(`items/${id}/cover.webp`),
                this.ossService.removeObject(`items/${id}/cover-thumbnail.webp`),
            ])
        })
    }
}