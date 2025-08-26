import { PrismaClient, Prisma } from '@prisma/client'
import { classInjection, injected } from '../util/injection-decorators'
import { TransactionStep, TransactionExecutionResult } from '../types/common.types'

@classInjection
export default class TransactionManager {
    @injected
    private prisma!: PrismaClient

    /**
     * 执行跨服务事务
     * 在单体阶段使用Prisma事务
     * 在微服务阶段可以替换为Saga或2PC
     */
    async executeTransaction<T>(
        steps: TransactionStep[],
        isolationLevel?: Prisma.TransactionIsolationLevel
    ): Promise<T> {
        return await this.prisma.$transaction(async (tx) => {
            const executedSteps: TransactionExecutionResult[] = []
            
            try {
                for (const step of steps) {
                    const result = await step.execute()
                    executedSteps.push({ step, result })
                }
                
                return executedSteps[executedSteps.length - 1]?.result as T
            } catch (error) {
                // 回滚已执行的步骤
                for (let i = executedSteps.length - 1; i >= 0; i--) {
                    const { step } = executedSteps[i]
                    if (step.rollback) {
                        try {
                            await step.rollback()
                        } catch (rollbackError) {
                            console.error(`Rollback failed for step ${step.name || step.stepName}:`, rollbackError)
                        }
                    }
                }
                throw error
            }
        }, { isolationLevel })
    }

    /**
     * 为单个服务操作创建事务步骤
     */
    createStep(
        stepName: string,
        execute: () => Promise<unknown>,
        rollback?: () => Promise<void>
    ): TransactionStep {
        return { name: stepName, execute, rollback }
    }
}
