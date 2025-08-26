// ========== 跨服务事务类型定义 ==========

/**
 * 分布式事务状态
 */
export enum DistributedTransactionStatus {
  PENDING = 'PENDING',
  EXECUTING = 'EXECUTING', 
  COMPLETED = 'COMPLETED',
  COMPENSATING = 'COMPENSATING',
  COMPENSATED = 'COMPENSATED',
  FAILED = 'FAILED'
}

/**
 * 服务标识
 */
export enum ServiceType {
  USER = 'USER',
  SHOP_ITEM = 'SHOP_ITEM',
  ADDRESS = 'ADDRESS',
  CART = 'CART',
  HISTORY = 'HISTORY',
  ORDER = 'ORDER',
  REVIEW = 'REVIEW',
  RECOMMENDATION = 'RECOMMENDATION'
}

/**
 * 分布式事务步骤
 */
export interface DistributedTransactionStep {
  stepId: string
  serviceName: ServiceType
  operationName: string
  execute: () => Promise<unknown>
  compensate?: () => Promise<void>
  timeout?: number
  retryCount?: number
}

/**
 * 分布式事务执行结果
 */
export interface DistributedTransactionResult {
  stepId: string
  serviceName: ServiceType
  operationName: string
  result: unknown
  timestamp: Date
  executionTime: number
}

/**
 * 分布式事务上下文
 */
export interface DistributedTransactionContext {
  transactionId: string
  status: DistributedTransactionStatus
  steps: DistributedTransactionStep[]
  results: DistributedTransactionResult[]
  compensationResults: DistributedTransactionResult[]
  startTime: Date
  endTime?: Date
  timeout: number
  metadata?: Record<string, unknown>
}

/**
 * 服务事务适配器接口
 */
export interface ServiceTransactionAdapter {
  serviceName: ServiceType
  executeOperation(operationName: string, params: unknown): Promise<unknown>
  compensateOperation(operationName: string, params: unknown): Promise<void>
  healthCheck(): Promise<boolean>
}

/**
 * 分布式事务配置
 */
export interface DistributedTransactionConfig {
  maxRetries: number
  defaultTimeout: number
  compensationTimeout: number
  enableLogging: boolean
  persistenceEnabled: boolean
}

/**
 * 事务执行选项
 */
export interface TransactionExecutionOptions {
  timeout?: number
  maxRetries?: number
  parallelExecution?: boolean
  compensationStrategy?: 'SEQUENTIAL' | 'PARALLEL'
  metadata?: Record<string, unknown>
}
