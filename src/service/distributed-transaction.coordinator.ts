import { v4 as uuidv4 } from 'uuid'
import { classInjection, injected } from '../util/injection-decorators'
import { PrismaClient } from '@prisma/client'
import {
  DistributedTransactionContext,
  DistributedTransactionStep,
  DistributedTransactionStatus,
  DistributedTransactionResult,
  DistributedTransactionConfig,
  TransactionExecutionOptions,
  ServiceTransactionAdapter,
  ServiceType
} from '../types/transaction.types'

@classInjection
export default class DistributedTransactionCoordinator {
  @injected
  private prisma!: PrismaClient

  private serviceAdapters = new Map<ServiceType, ServiceTransactionAdapter>()
  private activeTransactions = new Map<string, DistributedTransactionContext>()

  private config: DistributedTransactionConfig = {
    maxRetries: 3,
    defaultTimeout: 30000, // 30秒
    compensationTimeout: 60000, // 60秒
    enableLogging: true,
    persistenceEnabled: true
  }

  /**
   * 注册服务适配器
   */
  registerServiceAdapter(adapter: ServiceTransactionAdapter): void {
    this.serviceAdapters.set(adapter.serviceName, adapter)
  }

  /**
   * 创建分布式事务
   */
  async createDistributedTransaction(
    steps: DistributedTransactionStep[],
    options: TransactionExecutionOptions = {}
  ): Promise<string> {
    const transactionId = uuidv4()
    const context: DistributedTransactionContext = {
      transactionId,
      status: DistributedTransactionStatus.PENDING,
      steps,
      results: [],
      compensationResults: [],
      startTime: new Date(),
      timeout: options.timeout || this.config.defaultTimeout,
      metadata: options.metadata
    }

    this.activeTransactions.set(transactionId, context)

    if (this.config.persistenceEnabled) {
      await this.persistTransactionContext(context)
    }

    if (this.config.enableLogging) {
      console.log(`Created distributed transaction: ${transactionId}`)
    }

    return transactionId
  }

  /**
   * 执行分布式事务（Saga模式）
   */
  async executeDistributedTransaction(
    transactionId: string,
    options: TransactionExecutionOptions = {}
  ): Promise<DistributedTransactionResult[]> {
    const context = this.activeTransactions.get(transactionId)
    if (!context) {
      throw new Error(`Transaction not found: ${transactionId}`)
    }

    context.status = DistributedTransactionStatus.EXECUTING

    try {
      const results = options.parallelExecution
        ? await this.executeStepsParallel(context, options)
        : await this.executeStepsSequential(context, options)

      context.status = DistributedTransactionStatus.COMPLETED
      context.endTime = new Date()
      context.results = results

      if (this.config.enableLogging) {
        console.log(`Completed distributed transaction: ${transactionId}`)
      }

      return results
    } catch (error) {
      console.error(`Transaction failed: ${transactionId}`, error)
      await this.compensateTransaction(context, options)
      throw error
    } finally {
      if (this.config.persistenceEnabled) {
        await this.persistTransactionContext(context)
      }
    }
  }

  /**
   * 顺序执行事务步骤
   */
  private async executeStepsSequential(
    context: DistributedTransactionContext,
    options: TransactionExecutionOptions
  ): Promise<DistributedTransactionResult[]> {
    const results: DistributedTransactionResult[] = []

    for (let i = 0; i < context.steps.length; i++) {
      const step = context.steps[i]
      const startTime = Date.now()

      try {
        const result = await this.executeStepWithRetry(step, options.maxRetries || this.config.maxRetries)
        const executionTime = Date.now() - startTime

        const stepResult: DistributedTransactionResult = {
          stepId: step.stepId,
          serviceName: step.serviceName,
          operationName: step.operationName,
          result,
          timestamp: new Date(),
          executionTime
        }

        results.push(stepResult)

        if (this.config.enableLogging) {
          console.log(`Step completed: ${step.stepId} in ${executionTime}ms`)
        }
      } catch (error) {
        console.error(`Step failed: ${step.stepId}`, error)
        // 补偿已执行的步骤
        await this.compensateExecutedSteps(results.reverse(), options)
        throw error
      }
    }

    return results
  }

  /**
   * 并行执行事务步骤
   */
  private async executeStepsParallel(
    context: DistributedTransactionContext,
    options: TransactionExecutionOptions
  ): Promise<DistributedTransactionResult[]> {
    const stepPromises = context.steps.map(async (step) => {
      const startTime = Date.now()
      try {
        const result = await this.executeStepWithRetry(step, options.maxRetries || this.config.maxRetries)
        const executionTime = Date.now() - startTime

        return {
          stepId: step.stepId,
          serviceName: step.serviceName,
          operationName: step.operationName,
          result,
          timestamp: new Date(),
          executionTime
        } as DistributedTransactionResult
      } catch (error) {
        console.error(`Parallel step failed: ${step.stepId}`, error)
        throw error
      }
    })

    try {
      return await Promise.all(stepPromises)
    } catch (error) {
      // 如果任何步骤失败，需要补偿所有已完成的步骤
      const completedResults = await Promise.allSettled(stepPromises)
      const successfulResults = completedResults
        .filter((result): result is PromiseFulfilledResult<DistributedTransactionResult> => 
          result.status === 'fulfilled')
        .map(result => result.value)

      await this.compensateExecutedSteps(successfulResults, options)
      throw error
    }
  }

  /**
   * 带重试的步骤执行
   */
  private async executeStepWithRetry(
    step: DistributedTransactionStep,
    maxRetries: number
  ): Promise<unknown> {
    let lastError: Error
    const retryCount = step.retryCount || maxRetries

    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        if (attempt > 0) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000) // 指数退避，最大10秒
          await new Promise(resolve => setTimeout(resolve, delay))
        }

        return await this.executeWithTimeout(step.execute, step.timeout || this.config.defaultTimeout)
      } catch (error) {
        lastError = error as Error
        if (attempt < retryCount) {
          console.warn(`Step ${step.stepId} failed, retry ${attempt + 1}/${retryCount}:`, error)
        }
      }
    }

    throw lastError!
  }

  /**
   * 带超时的操作执行
   */
  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Operation timeout after ${timeout}ms`))
      }, timeout)

      operation()
        .then(result => {
          clearTimeout(timer)
          resolve(result)
        })
        .catch(error => {
          clearTimeout(timer)
          reject(error)
        })
    })
  }

  /**
   * 补偿事务
   */
  private async compensateTransaction(
    context: DistributedTransactionContext,
    options: TransactionExecutionOptions
  ): Promise<void> {
    context.status = DistributedTransactionStatus.COMPENSATING

    try {
      await this.compensateExecutedSteps(context.results, options)
      context.status = DistributedTransactionStatus.COMPENSATED
    } catch (error) {
      context.status = DistributedTransactionStatus.FAILED
      console.error(`Compensation failed for transaction: ${context.transactionId}`, error)
      throw error
    }
  }

  /**
   * 补偿已执行的步骤
   */
  private async compensateExecutedSteps(
    results: DistributedTransactionResult[],
    options: TransactionExecutionOptions
  ): Promise<void> {
    const compensationStrategy = options.compensationStrategy || 'SEQUENTIAL'

    if (compensationStrategy === 'PARALLEL') {
      await this.compensateStepsParallel(results)
    } else {
      await this.compensateStepsSequential(results)
    }
  }

  /**
   * 顺序补偿步骤
   */
  private async compensateStepsSequential(results: DistributedTransactionResult[]): Promise<void> {
    // 逆序补偿
    for (let i = results.length - 1; i >= 0; i--) {
      const result = results[i]
      await this.compensateStep(result)
    }
  }

  /**
   * 并行补偿步骤
   */
  private async compensateStepsParallel(results: DistributedTransactionResult[]): Promise<void> {
    const compensationPromises = results.map(result => this.compensateStep(result))
    await Promise.allSettled(compensationPromises)
  }

  /**
   * 补偿单个步骤
   */
  private async compensateStep(result: DistributedTransactionResult): Promise<void> {
    const adapter = this.serviceAdapters.get(result.serviceName)
    if (!adapter) {
      console.warn(`No adapter found for service: ${result.serviceName}`)
      return
    }

    try {
      await this.executeWithTimeout(
        () => adapter.compensateOperation(result.operationName, result.result),
        this.config.compensationTimeout
      )

      if (this.config.enableLogging) {
        console.log(`Compensated step: ${result.stepId}`)
      }
    } catch (error) {
      console.error(`Compensation failed for step: ${result.stepId}`, error)
      // 补偿失败时可以选择重试或记录到死信队列
    }
  }

  /**
   * 持久化事务上下文
   */
  private async persistTransactionContext(context: DistributedTransactionContext): Promise<void> {
    // 在真实的微服务环境中，这里应该保存到专门的事务日志存储
    // 现在使用数据库模拟
    try {
      // 这里可以扩展为保存到专门的事务表
      console.log(`Persisting transaction context: ${context.transactionId}`)
    } catch (error) {
      console.error('Failed to persist transaction context:', error)
    }
  }

  /**
   * 获取事务状态
   */
  getTransactionStatus(transactionId: string): DistributedTransactionStatus | null {
    const context = this.activeTransactions.get(transactionId)
    return context?.status || null
  }

  /**
   * 清理已完成的事务
   */
  async cleanupCompletedTransactions(olderThan: Date): Promise<void> {
    const toRemove: string[] = []

    for (const [transactionId, context] of this.activeTransactions) {
      if (
        (context.status === DistributedTransactionStatus.COMPLETED ||
         context.status === DistributedTransactionStatus.COMPENSATED ||
         context.status === DistributedTransactionStatus.FAILED) &&
        context.endTime &&
        context.endTime < olderThan
      ) {
        toRemove.push(transactionId)
      }
    }

    for (const transactionId of toRemove) {
      this.activeTransactions.delete(transactionId)
    }

    if (this.config.enableLogging && toRemove.length > 0) {
      console.log(`Cleaned up ${toRemove.length} completed transactions`)
    }
  }
}
