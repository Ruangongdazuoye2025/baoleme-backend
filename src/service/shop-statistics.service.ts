import { PrismaClient } from "@prisma/client";
import { classInjection, injected } from "../util/injection-decorators";
import { ResponseError } from "../util/errors";
import UserService from "./user.service";
import OrderService from "./order.service";
import ItemService from "./item.service";

@classInjection
export default class ShopStatisticsService {

    @injected
    protected declare prisma: PrismaClient

    @injected
    private userService!: UserService

    @injected
    private orderService!: OrderService

    @injected
    private itemService!: ItemService

    /**
     * Get shop statistics (sales, revenue)
     * Uses OrderService to avoid cross-service database access
     */
    async getShopStats(currentUserId: string, shopId: string, start: string, end: string) {
        // 验证店铺和权限（直接访问shop表，因为属于同一模块）
        const shop = await this.prisma.shop.findUnique({ where: { id: shopId } })
        if (!shop) throw new ResponseError(404, 'Shop not found')
        
        // 通过 UserService 获取用户信息
        const currentUser = await this.userService.getUser(currentUserId)
        if (!currentUser || (currentUser.role !== 'ADMIN' && shop.ownerId !== currentUserId)) {
            throw new ResponseError(403, 'Permission denied')
        }
        
        const s = new Date(start)
        const t = new Date(end)
        
        // Generate date list
        const dayMap = new Map<string, { sales: number, incomes: number }>()
        for (let d = new Date(s); d <= t; d.setDate(d.getDate() + 1)) {
            const key = d.toISOString().slice(0, 10)
            dayMap.set(key, { sales: 0, incomes: 0 })
        }
        
        // 通过 OrderService 获取每日收入数据
        const incomeAgg = await this.orderService.getShopDailyRevenue(shopId, s, t)
        for (const row of incomeAgg) {
            const day = row.finishedAt?.toISOString().slice(0, 10)
            if (day && dayMap.has(day)) {
                dayMap.get(day)!.incomes = row._sum.total || 0
            }
        }
        
        // 通过 OrderService 获取每日销量数据
        const salesAgg = await this.orderService.getShopDailySales(shopId, s, t)
        for (const row of salesAgg) {
            const day = row.order.finishedAt?.toISOString().slice(0, 10)
            if (day && dayMap.has(day)) {
                dayMap.get(day)!.sales += row.quantity || 0
            }
        }
        
        return {
            sales: Array.from(dayMap.values(), v => v.sales),
            incomes: Array.from(dayMap.values(), v => v.incomes)
        }
    }

    /**
     * Get shop best-selling items
     * Uses OrderService to avoid cross-service database access
     */
    async getShopTopItems(currentUserId: string, shopId: string, start: string, end: string, n?: number) {
        // 验证店铺和权限（直接访问shop表，因为属于同一模块）
        const shop = await this.prisma.shop.findUnique({ where: { id: shopId } })
        if (!shop) throw new ResponseError(404, 'Shop not found')
        
        // 通过 UserService 获取用户信息
        const currentUser = await this.userService.getUser(currentUserId)
        if (!currentUser || (currentUser.role !== 'ADMIN' && shop.ownerId !== currentUserId)) {
            throw new ResponseError(403, 'Permission denied')
        }
        
        const s = new Date(start)
        const t = new Date(end)
        
        // 通过 OrderService 获取商品销售统计
        const agg = await this.orderService.getShopItemSalesStats(shopId, s, t)
        
        // 获取商品信息（这些商品属于当前店铺服务范围，可以直接访问item表）

        const itemIds = agg.map(i => i.itemId!).filter(Boolean)
        const items = (await Promise.all(itemIds.map(async itemId => {
            try {
                // 使用 currentUserId 是因为已经在上面验证过权限
                return await this.itemService.getItem(currentUserId, itemId)
            } catch (error) {
                // 如果商品不存在或无权访问，返回 null
                return null
            }
        }))).filter((item): item is NonNullable<typeof item> => item !== null)
        const itemInfoMap = new Map(items.map(i => [i.id, i]))
        
        // Sort by sales and revenue
        const bySale = agg
            .map(i => ({ ...itemInfoMap.get(i.itemId!), queriedSale: i._sum.quantity || 0 }))
            .filter(item => item.id) // 过滤掉不属于当前店铺的商品
            .sort((a, b) => b.queriedSale - a.queriedSale)
            .slice(0, n || 10)
            
        const byIncome = agg
            .map(i => ({ ...itemInfoMap.get(i.itemId!), queriedIncome: i._sum.price || 0 }))
            .filter(item => item.id) // 过滤掉不属于当前店铺的商品
            .sort((a, b) => b.queriedIncome - a.queriedIncome)
            .slice(0, n || 10)
            
        // Total sales and total revenue
        const totalSale = agg.reduce((sum, i) => sum + (i._sum.quantity || 0), 0)
        const totalIncome = agg.reduce((sum, i) => sum + (i._sum.price || 0), 0)
        
        return {
            totalSale,
            totalIncome,
            bySale,
            byIncome
        }
    }
}
