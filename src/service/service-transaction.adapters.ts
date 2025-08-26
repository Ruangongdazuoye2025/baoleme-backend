import { PrismaClient } from '@prisma/client'
import { injected } from '../util/injection-decorators'
import { ServiceTransactionAdapter, ServiceType } from '../types/transaction.types'

/**
 * 服务事务适配器基类
 * 提供每个服务的事务操作接口
 */
export abstract class BaseServiceTransactionAdapter implements ServiceTransactionAdapter {
  @injected
  protected prisma!: PrismaClient

  abstract serviceName: ServiceType

  /**
   * 执行服务操作
   */
  abstract executeOperation(operationName: string, params: unknown): Promise<unknown>

  /**
   * 补偿服务操作
   */
  abstract compensateOperation(operationName: string, params: unknown): Promise<void>

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
}
