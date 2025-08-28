import { Item, ItemCategory, Prisma, PrismaClient, UserRole } from "@prisma/client";
import { classInjection, injected } from "../util/injection-decorators";
import { ResponseError } from "../util/errors";
import { CreateItem, UpdateItemProfile } from '../schema/item.schema'
import { BaseServiceUtils } from "./base.service";
import { FILE_CONSTANTS } from "../constants/app.constants";
import OSSService from "./oss.service";
import UserService from "./user.service";
import sharp from "sharp";
import ShopService from "./shop.service";

@classInjection
export default class ItemService {
    @injected
    protected declare prisma: PrismaClient

    @injected
    private ossService!: OSSService

    @injected
    private userService!: UserService

    @injected
    private shopService!: ShopService

    private readonly ossContentType = FILE_CONSTANTS.IMAGE_CONTENT_TYPE

    itemCategoryDataToItemCategoryInfo(category: ItemCategory) {
        return {
            id: category.id,
            name: category.name,
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

    async itemDataToFullItemInfo(item: Prisma.ItemGetPayload<{ include: { itemItemCategories: true } }>) {
        return {
            id: item.id,
            shopId: item.shopId,
            createdAt: item.createdAt,
            ...this.itemDataToItemProfile(item),
            ...await this.getItemImageLinks(item.id),
        }
    }

    itemDataToItemProfile(item: Prisma.ItemGetPayload<{ include: { itemItemCategories: true } }>) {
        return {
            name: item.name,
            description: item.description,
            available: item.available,
            stockout: item.stockout,
            price: item.price,
            priceWithoutPromotion: item.priceWithoutPromotion,
            categories: item.itemItemCategories.map(p => p.categoryId),
            rating: item.rating,
            sale: item.sale,
        }
    }

    async getShopCategoryItems(currentUserId:string,shopId:string,categoryId:string,pageSkip:number,pageLimit:number){
        return await this.prisma.$transaction(async tx => {
            const user = await this.userService.getUser(currentUserId)
            if (!user) {
                throw new ResponseError(401, 'Unauthorized');
            }
            return await tx.item.findMany({
                where: {
                    shopId: shopId,
                    itemItemCategories: { some: { categoryId: categoryId } }
                },
                skip: pageSkip,
                take: pageLimit,
                orderBy: { createdAt: 'desc' }
            });
        });
    }

    async getItems(currentUserId:string,shopId:string,pageSkip:number,pageLimit:number){
        return await this.prisma.$transaction(async tx => {
            const user = await this.userService.getUser(currentUserId)
            if (!user) {
                throw new ResponseError(401, 'Unauthorized');
            }

            return await tx.item.findMany({
                where: { 
                    shopId: shopId,
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
        })
        if (!item) {
            throw new ResponseError(404, 'Item not found')
        }
        const currentUser = await this.userService.getUser(currentUserId)
        if (!currentUser) {
            throw new ResponseError(401, 'Unauthorized')
        }
        const shop = await this.shopService.getShop(item.shopId)
        const onlyAvailable = currentUser.role !== 'ADMIN' && currentUser.id !== shop.ownerId;
        if (onlyAvailable && !item.available) {
            throw new ResponseError(404, 'Item not found')
        }
        return item
    }

    async createItem(userId: string,shopId:string,request: CreateItem){
        const { name, description, available, stockout, price, priceWithoutPromotion, categories} = request
        return await this.prisma.$transaction(async tx => {
            const user = await this.userService.getUser(userId)
            if (!user) {
                throw new ResponseError(401, 'Unauthorized')
            }
            
            const item = await tx.item.create({
                data: {
                    name,
                    description,
                    available,
                    stockout,
                    price,
                    priceWithoutPromotion,
                    shopId,
                    itemItemCategories: {
                        create: categories.map(id => ({ categoryId: id }))
                    }
                },
            })
            return item
        })
    }

    async updateItemProfile(userId: string, id: string, request:UpdateItemProfile){
        const { name, description, available, stockout, price, priceWithoutPromotion, categories } = request
        return await this.prisma.$transaction(async tx => {
            const item = await tx.item.findUnique({ 
                where: { id }
            })
            if (!item) {
                throw new ResponseError(404, 'Item not found')
            }
            const currentUser = await this.userService.getUser(userId)
            const shop = await this.shopService.getShop(item.shopId)
            if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.id !== shop.ownerId)) {
                throw new ResponseError(403, 'Permission denied')
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
                    itemItemCategories: {
                        deleteMany: {},
                        create: categories?.map(categoryId => ({ 
                            categoryId 
                        }))
                    }
                },
            });
            return updatedItem
        })
    }
    async updateItemImage(currentUserId: string, id: string, cover: Buffer | undefined) {
        await this.prisma.$transaction(async tx => {
            const item = await tx.item.findUnique({ 
                where: { id },
            })
            if (!item) {
                throw new ResponseError(404, 'Item not found')
            }
            const currentUser = await this.userService.getUser(currentUserId)
            const shop = await this.shopService.getShop(item.shopId)
            if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.id !== shop.ownerId)) {
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
            })
            if (!item) {
                throw new ResponseError(404, 'Item not found')
            }
            // 通过 UserService 获取用户信息
            const currentUser = await this.userService.getUser(currentUserId)
            const shop = await this.shopService.getShop(item.shopId)
            if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.id !== shop.ownerId)) {
                throw new ResponseError(403, 'Permission denied')
            }
            await tx.item.delete({ where: { id } })
            await Promise.all([
                this.ossService.removeObject(`items/${id}/cover.webp`),
                this.ossService.removeObject(`items/${id}/cover-thumbnail.webp`),
            ])
        })
    }

    async updateItemSale(itemId: string, saleCount: number) {
        return await this.prisma.item.update({
            where: { id: itemId },
            data: { sale: saleCount }
        })
    }

    async getShopItemIds(shopId: string): Promise<string[]> {
        const items = await this.prisma.item.findMany({
            where: { shopId },
            select: { id: true }
        })
        return items.map(item => item.id)
    }

    async updateItemRating(itemId: string, rating: number) {
        return await this.prisma.item.update({
            where: { id: itemId },
            data: { rating }
        })
    }
}