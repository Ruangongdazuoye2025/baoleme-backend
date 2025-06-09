import { describe, expect, test, jest, beforeEach } from '@jest/globals'
import { mockDeep } from 'jest-mock-extended'
import { PrismaClient, User } from '@prisma/client'
import * as awilix from 'awilix'
import HistoryService from '../../src/service/history.service'
import ShopService from '../../src/service/shop.service'
import ItemService from '../../src/service/item.service'
import { ResponseError } from '../../src/util/errors'

describe('history service', () => {
    const mockPrisma = mockDeep<PrismaClient>()
    const mockShopService = mockDeep<ShopService>()
    const mockItemService = mockDeep<ItemService>()
    const container = awilix.createContainer({
        injectionMode: awilix.InjectionMode.PROXY,
        strict: true,
    })
    container.register({
        prisma: awilix.asValue(mockPrisma),
        shopService: awilix.asValue(mockShopService),
        itemService: awilix.asValue(mockItemService),
        historyService: awilix.asClass(HistoryService),
    })
    let historyService = container.resolve<HistoryService>('historyService')

    beforeEach(() => {
        jest.clearAllMocks()
    })

    test('should throw if user not found in getShopHistory', async () => {
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
            const tx = mockDeep<PrismaClient>()
            tx.user.findUnique.mockResolvedValue(null)
            return cb(tx)
        })
        await expect(historyService.getShopHistory('u1', 0, 10)).rejects.toThrow(ResponseError)
    })

    test('should throw if user not found in getItemHistory', async () => {
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
            const tx = mockDeep<PrismaClient>()
            tx.user.findUnique.mockResolvedValue(null)
            return cb(tx)
        })
        await expect(historyService.getItemHistory('u1', 0, 10)).rejects.toThrow(ResponseError)
    })

    test('should return empty array if no shop history', async () => {
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
            const tx = mockDeep<PrismaClient>()
            tx.user.findUnique.mockResolvedValue({ id: 'u1' } as any)
            tx.shopHistory.findMany.mockResolvedValue([])
            return cb(tx)
        })
        const result = await historyService.getShopHistory('u1', 0, 10)
        expect(result).toEqual([])
    })

    test('should return empty array if no item history', async () => {
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
            const tx = mockDeep<PrismaClient>()
            tx.user.findUnique.mockResolvedValue({ id: 'u1' } as any)
            tx.itemHistory.findMany.mockResolvedValue([])
            return cb(tx)
        })
        const result = await historyService.getItemHistory('u1', 0, 10)
        expect(result).toEqual([])
    })

    test('should return empty array if no shop favourite', async () => {
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
            const tx = mockDeep<PrismaClient>()
            tx.user.findUnique.mockResolvedValue({ id: 'u1' } as any)
            tx.shopFavourite.findMany.mockResolvedValue([])
            return cb(tx)
        })
        const result = await historyService.getShopFavourite('u1', 0, 10)
        expect(result).toEqual([])
    })

    test('should return empty array if no item favourite', async () => {
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
            const tx = mockDeep<PrismaClient>()
            tx.user.findUnique.mockResolvedValue({ id: 'u1' } as any)
            tx.itemFavourite.findMany.mockResolvedValue([])
            return cb(tx)
        })
        const result = await historyService.getItemFavourite('u1', 0, 10)
        expect(result).toEqual([])
    })

})
