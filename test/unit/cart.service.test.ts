import { describe, expect, test, jest, beforeEach } from '@jest/globals'
import { mockDeep } from 'jest-mock-extended'
import { PrismaClient, CartItem, Item } from '@prisma/client'
import * as awilix from 'awilix'
import CartService from '../../src/service/cart.service'
import { ResponseError } from '../../src/util/errors'
import ItemService from '../../src/service/item.service'

describe('cart service', () => {
    const mockPrisma = mockDeep<PrismaClient>()
    const container = awilix.createContainer({
        injectionMode: awilix.InjectionMode.PROXY,
        strict: true,
    })
    container.register({
        prisma: awilix.asValue(mockPrisma),
        ossService: awilix.asValue({
            getObjectUrl: jest.fn(() => Promise.resolve('mock-url')),
            putObject: jest.fn(() => Promise.resolve('mock-url')),
            removeObject: jest.fn(() => Promise.resolve()),
        } as any),
        cartService: awilix.asClass(CartService),
        itemService: awilix.asClass(ItemService)
    })
    let cartService = container.resolve<CartService>('cartService')

    beforeEach(() => {
        jest.clearAllMocks()
        mockPrisma.shop.findUnique.mockResolvedValue({
            id: 's1',
            deliveryPrice: 0,
            deliveryThreshold: 0
        } as any)
    })

    test('should get cart item quantity', async () => {
        mockPrisma.cartItem.findUnique.mockResolvedValue({ quantity: 2, item: { shopId: 's1' } } as any)
        const result = await cartService.getCartItemQuantity('u1', 's1', 'i1')
        expect(result.quantity).toBe(2)
    })

    test('should throw if cart item not found', async () => {
        mockPrisma.cartItem.findUnique.mockResolvedValue(null)
        await expect(cartService.getCartItemQuantity('u1', 's1', 'i1')).rejects.toThrow()
    })

    test('should update cart item quantity', async () => {
        mockPrisma.item.findUnique.mockResolvedValue({ id: 'i1', shopId: 's1' } as any)
        mockPrisma.cartItem.upsert.mockResolvedValue({} as any)
        mockPrisma.cartItem.findMany.mockResolvedValue([])
        const result = await cartService.updateCartItemQuantity('u1', 's1', 'i1', 3)
        expect(result.quantity).toBe(3)
    })

    test('should clear cart', async () => {
        mockPrisma.cartItem.deleteMany.mockResolvedValue({ count: 1 })
        await expect(cartService.clearCart('u1', 's1')).resolves.not.toThrow()
    })

    test('should get cart info', async () => {
        mockPrisma.cartItem.findMany.mockResolvedValue([
            { quantity: 2, item: { price: 10, priceWithoutPromotion: 12, shopId: 's1', available: true, stockout: false, categories: [] } } as any,
            { quantity: 1, item: { price: 20, priceWithoutPromotion: 22, shopId: 's1', available: true, stockout: false, categories: [] } } as any
        ])
        const result = await cartService.getCartInfo('u1', 's1')
        expect(result.total).toBe(40)
        expect(result.totalWithoutPromotion).toBe(46)
        expect(result.settlable).toBe(true)
    })

    test('should get cart items', async () => {
        mockPrisma.cartItem.findMany.mockResolvedValue([
            { quantity: 2, item: { id: 'i1', shopId: 's1', categories: [], available: true, stockout: false } } as any
        ])
        const result = await cartService.getCartItems('u1', 's1')
        expect(result[0].quantity).toBe(2)
    })

    test('should remove cart item when quantity is 0', async () => {
        mockPrisma.item.findUnique.mockResolvedValue({ id: 'i1', shopId: 's1' } as any)
        mockPrisma.cartItem.findUnique.mockResolvedValue({ customerId: 'u1', itemId: 'i1', quantity: 2 } as any)
        mockPrisma.cartItem.delete.mockResolvedValue({} as any)
        mockPrisma.cartItem.findMany.mockResolvedValue([])
        const result = await cartService.updateCartItemQuantity('u1', 's1', 'i1', 0)
        expect(result.quantity).toBe(0)
    })

    test('should throw if item not found in shop', async () => {
        mockPrisma.item.findUnique.mockResolvedValue(null)
        await expect(cartService.updateCartItemQuantity('u1', 's1', 'i1', 1)).rejects.toThrow()
    })

    test('should update cart item quantity and delete when quantity is 0', async () => {
        mockPrisma.item.findUnique.mockResolvedValue({ id: 'i1', shopId: 's1' } as any)
        mockPrisma.cartItem.findUnique.mockResolvedValue({ customerId: 'u1', itemId: 'i1', quantity: 2, item: { shopId: 's1' } } as any)
        mockPrisma.cartItem.delete.mockResolvedValue({} as any)
        mockPrisma.cartItem.findMany.mockResolvedValue([])
        const result = await cartService.updateCartItemQuantity('u1', 's1', 'i1', 0)
        expect(result.quantity).toBe(0)
    })

    test('should update cart item quantity and upsert when quantity > 0', async () => {
        mockPrisma.item.findUnique.mockResolvedValue({ id: 'i1', shopId: 's1' } as any)
        mockPrisma.cartItem.upsert.mockResolvedValue({ customerId: 'u1', itemId: 'i1', quantity: 3 } as any)
        mockPrisma.cartItem.findMany.mockResolvedValue([])
        const result = await cartService.updateCartItemQuantity('u1', 's1', 'i1', 3)
        expect(result.quantity).toBe(3)
    })

    test('should throw if updateCartItemQuantity with negative quantity', async () => {
        await expect(cartService.updateCartItemQuantity('u1', 's1', 'i1', -1))
    })

    test('should throw if getCartInfo returns empty', async () => {
        mockPrisma.cartItem.findMany.mockResolvedValue([])
        const result = await cartService.getCartInfo('u1', 's1')
        expect(result.total).toBe(0)
        expect(result.settlable).toBe(false)
    })

    test('should throw if getCartItems returns empty', async () => {
        mockPrisma.cartItem.findMany.mockResolvedValue([])
        const result = await cartService.getCartItems('u1', 's1')
        expect(result).toEqual([])
    })

})
