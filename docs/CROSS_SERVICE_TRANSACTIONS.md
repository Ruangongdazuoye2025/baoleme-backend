# 跨服务事务机制

## 概述

本项目实现了一套完整的跨服务事务机制，支持在单体应用向微服务架构迁移过程中保证数据一致性。该机制基于Saga模式设计，具备以下特性：

- **分布式事务协调**：支持跨多个服务的复杂业务流程
- **补偿机制**：自动处理事务失败时的回滚操作
- **可扩展性**：易于适配真实的微服务环境
- **故障恢复**：提供重试和超时机制
- **监控支持**：完整的事务状态跟踪

## 架构设计

### 核心组件

1. **DistributedTransactionCoordinator** - 分布式事务协调器
2. **ServiceTransactionAdapter** - 服务事务适配器
3. **CrossServiceTransactionManager** - 跨服务事务管理器

### 事务流程

```
客户端请求 → 创建分布式事务 → 顺序/并行执行步骤 → 成功完成 OR 补偿回滚
```

## 使用方法

### 1. 基本事务创建

```typescript
import { CrossServiceTransactionManager } from '../service/cross-service-transaction.manager'

// 注入事务管理器
@injected
private transactionManager!: CrossServiceTransactionManager

// 执行用户注册事务
const result = await this.transactionManager.executeUserRegistrationTransaction({
  email: 'user@example.com',
  password: 'hashedPassword',
  name: 'John Doe'
}, {
  timeout: 30000,
  maxRetries: 2
})
```

### 2. 订单创建事务

```typescript
// 执行订单创建事务（涉及多个服务）
const orderResult = await this.transactionManager.executeOrderCreationTransaction({
  customerId: 'user123',
  orderCreateInput: orderData,
  items: [
    { itemId: 'item1', quantity: 2 },
    { itemId: 'item2', quantity: 1 }
  ]
}, {
  timeout: 60000,
  parallelExecution: false,
  compensationStrategy: 'SEQUENTIAL'
})
```

### 3. 自定义事务步骤

```typescript
import { DistributedTransactionStep, ServiceType } from '../types/transaction.types'

const customSteps: DistributedTransactionStep[] = [
  {
    stepId: 'step-1',
    serviceName: ServiceType.ORDER,
    operationName: 'createOrder',
    execute: async () => {
      // 执行订单创建逻辑
      return await orderService.createOrder(orderData)
    },
    compensate: async () => {
      // 补偿逻辑：删除已创建的订单
      await orderService.deleteOrder(orderId)
    },
    timeout: 30000,
    retryCount: 2
  },
  // 更多步骤...
]

const transactionId = await coordinator.createDistributedTransaction(customSteps)
const results = await coordinator.executeDistributedTransaction(transactionId)
```

## 事务配置

### 执行选项

```typescript
interface TransactionExecutionOptions {
  timeout?: number                    // 事务超时时间（毫秒）
  maxRetries?: number                // 最大重试次数
  parallelExecution?: boolean        // 是否并行执行步骤
  compensationStrategy?: 'SEQUENTIAL' | 'PARALLEL'  // 补偿策略
  metadata?: Record<string, unknown> // 附加元数据
}
```

### 服务适配器

每个服务需要实现 `ServiceTransactionAdapter` 接口：

```typescript
export class CustomServiceAdapter extends BaseServiceTransactionAdapter {
  serviceName = ServiceType.CUSTOM

  async executeOperation(operationName: string, params: unknown): Promise<unknown> {
    switch (operationName) {
      case 'createResource':
        return await this.createResource(params)
      case 'updateResource':
        return await this.updateResource(params)
      default:
        throw new Error(`Unknown operation: ${operationName}`)
    }
  }

  async compensateOperation(operationName: string, params: unknown): Promise<void> {
    switch (operationName) {
      case 'createResource':
        await this.compensateCreateResource(params)
        break
      case 'updateResource':
        await this.compensateUpdateResource(params)
        break
      default:
        console.warn(`No compensation defined for: ${operationName}`)
    }
  }
}
```

## 监控和管理

### 事务状态查询

```typescript
const status = await transactionManager.getTransactionStatus(transactionId)
console.log(`Transaction ${transactionId} status: ${status}`)
```

### 清理旧事务

```typescript
// 清理7天前的已完成事务
await transactionManager.cleanupOldTransactions(7)
```

## 微服务迁移路径

### 当前阶段（单体应用）

- 使用 Prisma 数据库事务作为底层实现
- 所有服务适配器操作同一个数据库
- 事务协调通过内存状态管理

### 微服务阶段（未来）

- 替换为真实的分布式事务协调器（如 Apache Seata）
- 每个服务适配器通过网络调用独立的微服务
- 事务状态持久化到专用的事务日志存储

### 迁移策略

1. **保持接口不变**：业务代码无需修改
2. **替换实现层**：只需更换底层的协调器和适配器实现
3. **渐进式迁移**：可以逐个服务迁移到独立部署

## 最佳实践

### 1. 事务设计原则

- **幂等性**：确保每个步骤可以安全重试
- **可补偿性**：为每个步骤设计对应的补偿操作
- **超时设置**：为长时间运行的操作设置合理超时
- **状态检查**：在关键点检查资源状态

### 2. 错误处理

```typescript
try {
  const result = await transactionManager.executeOrderCreationTransaction(data)
  console.log('Transaction completed:', result.transactionId)
} catch (error) {
  console.error('Transaction failed:', error.message)
  // 事务已自动进行补偿
}
```

### 3. 并发控制

- 对于独立的业务操作，使用并行执行提高性能
- 对于有依赖关系的操作，使用顺序执行保证正确性
- 使用乐观锁或悲观锁处理资源竞争

### 4. 补偿策略

- **关键操作**：使用顺序补偿确保完整回滚
- **非关键操作**：使用并行补偿提高效率
- **补偿失败**：记录到死信队列待人工处理

## 示例场景

### 电商订单处理

```typescript
// 完整的订单处理流程
const orderTransaction = await transactionManager.executeOrderCreationTransaction({
  customerId: 'user123',
  orderCreateInput: {
    // 订单数据
  },
  items: [
    { itemId: 'product1', quantity: 2 },
    { itemId: 'product2', quantity: 1 }
  ]
}, {
  timeout: 120000,
  maxRetries: 2,
  compensationStrategy: 'SEQUENTIAL'
})

// 涉及的服务操作：
// 1. 订单服务：创建订单记录
// 2. 库存服务：更新商品库存
// 3. 购物车服务：清空购物车
// 4. 用户服务：更新用户积分
// 5. 通知服务：发送订单确认邮件
```

### 用户注册流程

```typescript
// 用户注册事务
const registrationResult = await transactionManager.executeUserRegistrationTransaction({
  email: 'newuser@example.com',
  password: 'hashedPassword',
  name: 'New User'
}, {
  timeout: 60000,
  maxRetries: 3
})

// 涉及的服务操作：
// 1. 用户服务：创建用户账户
// 2. 邮件服务：发送验证邮件
// 3. 权限服务：分配默认权限
// 4. 钱包服务：创建用户钱包
```

## 性能考虑

- **批量操作**：支持批量处理相似的事务
- **缓存优化**：缓存频繁访问的资源状态
- **连接池**：合理配置数据库连接池
- **监控指标**：跟踪事务执行时间和成功率

## 故障恢复

- **自动重试**：支持指数退避的重试机制
- **断路器**：防止故障服务影响整体性能
- **状态持久化**：事务状态可恢复
- **人工干预**：提供管理接口处理异常情况
