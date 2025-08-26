import { classInjection, injected } from '../util/injection-decorators'
import DistributedTransactionCoordinator from './distributed-transaction.coordinator'
import UserServiceTransactionAdapter from './user-service-transaction.adapter'
import OrderServiceTransactionAdapter from './order-service-transaction.adapter'
import {
  DistributedTransactionStep,
  ServiceType,
  TransactionExecutionOptions,
  DistributedTransactionResult
} from '../types/transaction.types'
import { v4 as uuidv4 } from 'uuid'

/**
 * 跨服务事务管理器
 * 提供高级API来管理复杂的跨服务业务流程事务
 */
@classInjection
export default class CrossServiceTransactionManager {
  @injected("distributedTransactionCoordinator")
  private coordinator!: DistributedTransactionCoordinator

  @injected
  private userServiceTransactionAdapter!: UserServiceTransactionAdapter

  @injected
  private orderServiceTransactionAdapter!: OrderServiceTransactionAdapter

  async initialize(): Promise<void> {
    // 注册所有服务适配器
    this.coordinator.registerServiceAdapter(this.userServiceTransactionAdapter)
    this.coordinator.registerServiceAdapter(this.orderServiceTransactionAdapter)
  }

  /**
   * 用户注册跨服务事务
   * 涉及：用户创建 + 邮件发送 + 初始化用户配置
   */
  async executeUserRegistrationTransaction(
    userData: UserRegistrationData,
    options: TransactionExecutionOptions = {}
  ): Promise<UserRegistrationResult> {
    const steps: DistributedTransactionStep[] = [
      {
        stepId: uuidv4(),
        serviceName: ServiceType.USER,
        operationName: 'createUser',
        execute: async () => {
          return await this.userServiceTransactionAdapter.executeOperation('createUser', {
            email: userData.email,
            password: userData.password,
            name: userData.name
          })
        }
      },
      {
        stepId: uuidv4(),
        serviceName: ServiceType.USER,
        operationName: 'sendVerificationEmail',
        execute: async () => {
          // 这里应该调用邮件服务
          console.log(`Sending verification email to ${userData.email}`)
          return { emailSent: true }
        }
      }
    ]

    const transactionId = await this.coordinator.createDistributedTransaction(steps, options)
    const results = await this.coordinator.executeDistributedTransaction(transactionId, options)

    return {
      transactionId,
      userId: (results[0].result as any).userId,
      email: userData.email,
      verificationEmailSent: (results[1].result as any).emailSent
    }
  }

  /**
   * 订单创建跨服务事务
   * 涉及：订单创建 + 库存更新 + 购物车清空 + 积分更新
   */
  async executeOrderCreationTransaction(
    orderData: OrderCreationData,
    options: TransactionExecutionOptions = {}
  ): Promise<OrderCreationResult> {
    const steps: DistributedTransactionStep[] = [
      // 步骤1：创建订单
      {
        stepId: uuidv4(),
        serviceName: ServiceType.ORDER,
        operationName: 'createOrder',
        execute: async () => {
          return await this.orderServiceTransactionAdapter.executeOperation('createOrder', {
            orderData: orderData.orderCreateInput
          })
        }
      },
      // 步骤2：更新商品销量
      {
        stepId: uuidv4(),
        serviceName: ServiceType.ORDER,
        operationName: 'updateItemsSale',
        execute: async () => {
          return await this.orderServiceTransactionAdapter.executeOperation('updateItemsSale', {
            items: orderData.items
          })
        }
      },
      // 步骤3：清空购物车
      {
        stepId: uuidv4(),
        serviceName: ServiceType.CART,
        operationName: 'clearCart',
        execute: async () => {
          // 这里应该调用购物车服务
          console.log(`Clearing cart for user ${orderData.customerId}`)
          return { cartCleared: true }
        }
      },
      // 步骤4：更新用户积分
      {
        stepId: uuidv4(),
        serviceName: ServiceType.USER,
        operationName: 'updateUserPoints',
        execute: async () => {
          // 这里应该调用用户服务更新积分
          const points = Math.floor(orderData.orderCreateInput.total * 0.01) // 1%返积分
          console.log(`Adding ${points} points to user ${orderData.customerId}`)
          return { pointsAdded: points }
        }
      }
    ]

    const transactionId = await this.coordinator.createDistributedTransaction(steps, options)
    const results = await this.coordinator.executeDistributedTransaction(transactionId, options)

    return {
      transactionId,
      orderId: (results[0].result as any).orderId,
      itemsUpdated: (results[1].result as any).updates.length,
      cartCleared: (results[2].result as any).cartCleared,
      pointsAdded: (results[3].result as any).pointsAdded
    }
  }

  /**
   * 订单取消跨服务事务
   * 涉及：订单状态更新 + 库存恢复 + 退款处理 + 积分回退
   */
  async executeOrderCancellationTransaction(
    cancellationData: OrderCancellationData,
    options: TransactionExecutionOptions = {}
  ): Promise<OrderCancellationResult> {
    const steps: DistributedTransactionStep[] = [
      // 步骤1：取消订单
      {
        stepId: uuidv4(),
        serviceName: ServiceType.ORDER,
        operationName: 'cancelOrder',
        execute: async () => {
          return await this.orderServiceTransactionAdapter.executeOperation('cancelOrder', {
            orderId: cancellationData.orderId
          })
        }
      },
      // 步骤2：恢复库存
      {
        stepId: uuidv4(),
        serviceName: ServiceType.ORDER,
        operationName: 'restoreItemsSale',
        execute: async () => {
          return await this.orderServiceTransactionAdapter.executeOperation('updateItemsSale', {
            items: cancellationData.items.map(item => ({
              itemId: item.itemId,
              quantity: -item.quantity // 负数表示减少销量
            }))
          })
        }
      },
      // 步骤3：处理退款
      {
        stepId: uuidv4(),
        serviceName: ServiceType.ORDER,
        operationName: 'processRefund',
        execute: async () => {
          // 这里应该调用支付服务处理退款
          console.log(`Processing refund for order ${cancellationData.orderId}`)
          return { refundProcessed: true, amount: cancellationData.refundAmount }
        }
      },
      // 步骤4：回退积分
      {
        stepId: uuidv4(),
        serviceName: ServiceType.USER,
        operationName: 'revertUserPoints',
        execute: async () => {
          // 这里应该调用用户服务回退积分
          const points = Math.floor(cancellationData.refundAmount * 0.01)
          console.log(`Reverting ${points} points from user ${cancellationData.customerId}`)
          return { pointsReverted: points }
        }
      }
    ]

    const transactionId = await this.coordinator.createDistributedTransaction(steps, options)
    const results = await this.coordinator.executeDistributedTransaction(transactionId, options)

    return {
      transactionId,
      orderCanceled: true,
      stockRestored: (results[1].result as any).updates.length > 0,
      refundProcessed: (results[2].result as any).refundProcessed,
      pointsReverted: (results[3].result as any).pointsReverted
    }
  }

  /**
   * 批量订单处理跨服务事务
   * 支持并行处理多个订单
   */
  async executeBatchOrderProcessingTransaction(
    orders: BatchOrderData[],
    options: TransactionExecutionOptions = {}
  ): Promise<BatchOrderResult> {
    const allSteps: DistributedTransactionStep[] = []

    // 为每个订单创建处理步骤
    for (const orderData of orders) {
      allSteps.push({
        stepId: uuidv4(),
        serviceName: ServiceType.ORDER,
        operationName: 'processOrder',
        execute: async () => {
          // 处理单个订单的逻辑
          const result = await this.orderServiceTransactionAdapter.executeOperation('updateOrderStatus', {
            orderId: orderData.orderId,
            newStatus: orderData.newStatus
          })
          return { orderId: orderData.orderId, result }
        }
      })
    }

    // 启用并行执行
    const parallelOptions = { ...options, parallelExecution: true }
    const transactionId = await this.coordinator.createDistributedTransaction(allSteps, parallelOptions)
    const results = await this.coordinator.executeDistributedTransaction(transactionId, parallelOptions)

    return {
      transactionId,
      processedCount: results.length,
      successfulOrders: results.map(r => (r.result as any).orderId),
      processingTime: results.reduce((total, r) => total + r.executionTime, 0)
    }
  }

  /**
   * 获取事务状态
   */
  async getTransactionStatus(transactionId: string) {
    return this.coordinator.getTransactionStatus(transactionId)
  }

  /**
   * 清理旧事务记录
   */
  async cleanupOldTransactions(daysOld: number = 7): Promise<void> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)
    await this.coordinator.cleanupCompletedTransactions(cutoffDate)
  }
}

// 类型定义
export interface UserRegistrationData {
  email: string
  password: string
  name?: string
}

export interface UserRegistrationResult {
  transactionId: string
  userId: string
  email: string
  verificationEmailSent: boolean
}

export interface OrderCreationData {
  customerId: string
  orderCreateInput: any // Prisma.OrderCreateInput
  items: Array<{ itemId: string; quantity: number }>
}

export interface OrderCreationResult {
  transactionId: string
  orderId: string
  itemsUpdated: number
  cartCleared: boolean
  pointsAdded: number
}

export interface OrderCancellationData {
  orderId: string
  customerId: string
  items: Array<{ itemId: string; quantity: number }>
  refundAmount: number
}

export interface OrderCancellationResult {
  transactionId: string
  orderCanceled: boolean
  stockRestored: boolean
  refundProcessed: boolean
  pointsReverted: number
}

export interface BatchOrderData {
  orderId: string
  newStatus: any // OrderStatus
}

export interface BatchOrderResult {
  transactionId: string
  processedCount: number
  successfulOrders: string[]
  processingTime: number
}
