import { PrismaClient } from '@prisma/client'
import { classInjection, injected } from '../util/injection-decorators'
import { ServiceTransactionAdapter, ServiceType } from '../types/transaction.types'

/**
 * 用户服务事务适配器
 */
@classInjection
export default class UserServiceTransactionAdapter implements ServiceTransactionAdapter {
  @injected
  protected prisma!: PrismaClient

  serviceName = ServiceType.USER

  async executeOperation(operationName: string, params: unknown): Promise<unknown> {
    switch (operationName) {
      case 'createUser':
        return await this.createUser(params as CreateUserParams)
      case 'updateUser':
        return await this.updateUser(params as UpdateUserParams)
      case 'deleteUser':
        return await this.deleteUser(params as DeleteUserParams)
      case 'verifyEmail':
        return await this.verifyEmail(params as VerifyEmailParams)
      default:
        throw new Error(`Unknown operation: ${operationName}`)
    }
  }

  async compensateOperation(operationName: string, params: unknown): Promise<void> {
    switch (operationName) {
      case 'createUser':
        await this.compensateCreateUser(params)
        break
      case 'updateUser':
        await this.compensateUpdateUser(params)
        break
      case 'deleteUser':
        await this.compensateDeleteUser(params)
        break
      case 'verifyEmail':
        await this.compensateVerifyEmail(params)
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

  // 用户操作实现
  private async createUser(params: CreateUserParams): Promise<unknown> {
    const user = await this.prisma.user.create({
      data: {
        email: params.email,
        password: params.password,
        name: params.name
      }
    })
    return { userId: user.id, email: user.email }
  }

  private async updateUser(params: UpdateUserParams): Promise<unknown> {
    const oldUser = await this.prisma.user.findUnique({ where: { id: params.userId } })
    const updatedUser = await this.prisma.user.update({
      where: { id: params.userId },
      data: params.updateData
    })
    return { oldData: oldUser, newData: updatedUser }
  }

  private async deleteUser(params: DeleteUserParams): Promise<unknown> {
    const user = await this.prisma.user.delete({ where: { id: params.userId } })
    return { deletedUser: user }
  }

  private async verifyEmail(params: VerifyEmailParams): Promise<unknown> {
    const oldUser = await this.prisma.user.findUnique({ where: { id: params.userId } })
    const updatedUser = await this.prisma.user.update({
      where: { id: params.userId },
      data: { isVerified: true }
    })
    return { oldData: oldUser, newData: updatedUser }
  }

  // 补偿操作实现
  private async compensateCreateUser(result: unknown): Promise<void> {
    const data = result as { userId: string }
    await this.prisma.user.delete({ where: { id: data.userId } })
  }

  private async compensateUpdateUser(result: unknown): Promise<void> {
    const data = result as { oldData: any; newData: any }
    if (data.oldData) {
      await this.prisma.user.update({
        where: { id: data.newData.id },
        data: data.oldData
      })
    }
  }

  private async compensateDeleteUser(result: unknown): Promise<void> {
    const data = result as { deletedUser: any }
    await this.prisma.user.create({ data: data.deletedUser })
  }

  private async compensateVerifyEmail(result: unknown): Promise<void> {
    const data = result as { oldData: any; newData: any }
    if (data.oldData) {
      await this.prisma.user.update({
        where: { id: data.newData.id },
        data: { isVerified: data.oldData.isVerified }
      })
    }
  }
}

// 参数类型定义
interface CreateUserParams {
  email: string
  password: string
  name?: string
}

interface UpdateUserParams {
  userId: string
  updateData: Record<string, unknown>
}

interface DeleteUserParams {
  userId: string
}

interface VerifyEmailParams {
  userId: string
}
