import { PrismaClient } from '@prisma/client'
import { 
  IUserService, 
  IShopService, 
  IItemService, 
  IAddressService, 
  ICartService, 
  IOrderService, 
  IReviewService, 
  IHistoryService,
  IRecommendedService 
} from '../types/service.interfaces'

import UserService from './user.service'
import ShopService from './shop.service'
import ItemService from './item.service'
import AddressService from './address.service'
import CartService from './cart.service'
import OrderService from './order.service'
import ReviewService from './review.service'
import HistoryService from './history.service'
import RecommendedService from './recommended.service'
import TransactionManager from './transaction.manager'

/**
 * 服务注册器
 * 管理所有微服务实例和依赖关系
 * 为将来迁移到Molecular做准备
 */
export class ServiceRegistry {
  private static instance: ServiceRegistry
  private services: Map<string, any> = new Map()

  private constructor() {}

  static getInstance(): ServiceRegistry {
    if (!ServiceRegistry.instance) {
      ServiceRegistry.instance = new ServiceRegistry()
    }
    return ServiceRegistry.instance
  }

  /**
   * 初始化所有服务
   */
  async initialize(prisma: PrismaClient) {
    // 创建事务管理器
    const transactionManager = new TransactionManager()
    
    // 创建各个服务实例
    const userService = new UserService()
    const shopService = new ShopService()
    const itemService = new ItemService()
    const addressService = new AddressService()
    const cartService = new CartService()
    const orderService = new OrderService()
    const reviewService = new ReviewService()
    const historyService = new HistoryService()
    const recommendedService = new RecommendedService()

    // 注册服务
    this.registerService('user', userService)
    this.registerService('shop', shopService)
    this.registerService('item', itemService)
    this.registerService('address', addressService)
    this.registerService('cart', cartService)
    this.registerService('order', orderService)
    this.registerService('review', reviewService)
    this.registerService('history', historyService)
    this.registerService('recommended', recommendedService)
    this.registerService('transaction', transactionManager)

    console.log('All microservices initialized successfully')
  }

  /**
   * 注册服务
   */
  registerService(name: string, service: unknown) {
    this.services.set(name, service)
  }

  /**
   * 获取服务实例
   */
  getService<T>(name: string): T {
    const service = this.services.get(name)
    if (!service) {
      throw new Error(`Service ${name} not found`)
    }
    return service as T
  }

  /**
   * 获取用户服务
   */
  getUserService(): IUserService {
    return this.getService<IUserService>('user')
  }

  /**
   * 获取店铺服务
   */
  getShopService(): IShopService {
    return this.getService<IShopService>('shop')
  }

  /**
   * 获取商品服务
   */
  getItemService(): IItemService {
    return this.getService<IItemService>('item')
  }

  /**
   * 获取地址服务
   */
  getAddressService(): IAddressService {
    return this.getService<IAddressService>('address')
  }

  /**
   * 获取购物车服务
   */
  getCartService(): ICartService {
    return this.getService<ICartService>('cart')
  }

  /**
   * 获取订单服务
   */
  getOrderService(): IOrderService {
    return this.getService<IOrderService>('order')
  }

  /**
   * 获取评论服务
   */
  getReviewService(): IReviewService {
    return this.getService<IReviewService>('review')
  }

  /**
   * 获取历史记录服务
   */
  getHistoryService(): IHistoryService {
    return this.getService<IHistoryService>('history')
  }

  /**
   * 获取推荐服务
   */
  getRecommendedService(): IRecommendedService {
    return this.getService<IRecommendedService>('recommended')
  }

  /**
   * 获取事务管理器
   */
  getTransactionManager(): TransactionManager {
    return this.getService<TransactionManager>('transaction')
  }

  /**
   * 获取所有服务名称
   */
  getServiceNames(): string[] {
    return Array.from(this.services.keys())
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{ [serviceName: string]: boolean }> {
    const health: { [serviceName: string]: boolean } = {}
    
    for (const [name, service] of this.services) {
      try {
        // 简单的健康检查，检查服务是否可用
        if (typeof service === 'object' && service !== null) {
          health[name] = true
        } else {
          health[name] = false
        }
      } catch (error) {
        health[name] = false
      }
    }
    
    return health
  }
}
