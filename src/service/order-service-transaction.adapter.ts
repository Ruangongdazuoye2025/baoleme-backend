import { PrismaClient, OrderStatus, Prisma } from '@prisma/client'
import { classInjection, injected } from '../util/injection-decorators'
import { ServiceTransactionAdapter, ServiceType } from '../types/transaction.types'

/**
 * 订单服务事务适配器
 */
@classInjection
export default class OrderServiceTransactionAdapter implements ServiceTransactionAdapter {
  @injected
  protected prisma!: PrismaClient

  serviceName = ServiceType.ORDER

  async executeOperation(operationName: string, params: unknown): Promise<unknown> {
    switch (operationName) {
      case 'createOrder':
        return await this.createOrder(params as CreateOrderParams)
      case 'updateOrderStatus':
        return await this.updateOrderStatus(params as UpdateOrderStatusParams)
      case 'cancelOrder':
        return await this.cancelOrder(params as CancelOrderParams)
      case 'updateItemsSale':
        return await this.updateItemsSale(params as UpdateItemsSaleParams)
      default:
        throw new Error(`Unknown operation: ${operationName}`)
    }
  }

  async compensateOperation(operationName: string, params: unknown): Promise<void> {
    switch (operationName) {
      case 'createOrder':
        await this.compensateCreateOrder(params)
        break
      case 'updateOrderStatus':
        await this.compensateUpdateOrderStatus(params)
        break
      case 'cancelOrder':
        await this.compensateCancelOrder(params)
        break
      case 'updateItemsSale':
        await this.compensateUpdateItemsSale(params)
        break
      default:
        console.warn(`No compensation defined for operation: ${operationName}`)
    }
  }

  /**
   * 服务健康检查
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`
      return true
    } catch (error) {
      console.error(`Health check failed for service ${this.serviceName}:`, error)
      return false
    }
  }

  /**
   * 创建补偿数据记录
   */
  protected async createCompensationRecord(
    operationName: string,
    originalData: unknown,
    compensationData: unknown
  ): Promise<void> {
    // 在真实微服务环境中，这应该保存到补偿日志表
    console.log(`Compensation record created for ${this.serviceName}.${operationName}`)
  }

  /**
   * 获取补偿数据
   */
  protected async getCompensationData(
    operationName: string,
    operationResult: unknown
  ): Promise<unknown> {
    // 根据操作结果获取补偿所需的数据
    return operationResult
  }

  // 订单操作实现
  private async createOrder(params: CreateOrderParams): Promise<unknown> {
    const order = await this.prisma.order.create({
      data: params.orderData as Prisma.OrderCreateInput
    })
    return { orderId: order.id, orderData: order }
  }

  private async updateOrderStatus(params: UpdateOrderStatusParams): Promise<unknown> {
    const oldOrder = await this.prisma.order.findUnique({ where: { id: params.orderId } })
    const updatedOrder = await this.prisma.order.update({
      where: { id: params.orderId },
      data: { status: params.newStatus as OrderStatus }
    })
    return { oldData: oldOrder, newData: updatedOrder }
  }

  private async cancelOrder(params: CancelOrderParams): Promise<unknown> {
    const oldOrder = await this.prisma.order.findUnique({ where: { id: params.orderId } })
    const canceledOrder = await this.prisma.order.update({
      where: { id: params.orderId },
      data: { 
        status: 'CANCELED',
        canceledAt: new Date()
      }
    })
    return { oldData: oldOrder, newData: canceledOrder }
  }

  private async updateItemsSale(params: UpdateItemsSaleParams): Promise<unknown> {
    const updateResults = []
    for (const item of params.items) {
      const oldItem = await this.prisma.item.findUnique({ where: { id: item.itemId } })
      const updatedItem = await this.prisma.item.update({
        where: { id: item.itemId },
        data: { sale: { increment: item.quantity } }
      })
      updateResults.push({ oldData: oldItem, newData: updatedItem })
    }
    return { updates: updateResults }
  }

  // 补偿操作实现
  private async compensateCreateOrder(result: unknown): Promise<void> {
    const data = result as { orderId: string }
    await this.prisma.order.delete({ where: { id: data.orderId } })
  }

  private async compensateUpdateOrderStatus(result: unknown): Promise<void> {
    const data = result as { oldData: any; newData: any }
    if (data.oldData) {
      await this.prisma.order.update({
        where: { id: data.newData.id },
        data: { status: data.oldData.status }
      })
    }
  }

  private async compensateCancelOrder(result: unknown): Promise<void> {
    const data = result as { oldData: any; newData: any }
    if (data.oldData) {
      await this.prisma.order.update({
        where: { id: data.newData.id },
        data: { 
          status: data.oldData.status,
          canceledAt: data.oldData.canceledAt
        }
      })
    }
  }

  private async compensateUpdateItemsSale(result: unknown): Promise<void> {
    const data = result as { updates: Array<{ oldData: any; newData: any }> }
    for (const update of data.updates) {
      if (update.oldData) {
        await this.prisma.item.update({
          where: { id: update.newData.id },
          data: { sale: update.oldData.sale }
        })
      }
    }
  }
}

// 参数类型定义
interface CreateOrderParams {
  orderData: Prisma.OrderCreateInput
}

interface UpdateOrderStatusParams {
  orderId: string
  newStatus: OrderStatus
}

interface CancelOrderParams {
  orderId: string
}

interface UpdateItemsSaleParams {
  items: Array<{ itemId: string; quantity: number }>
}
