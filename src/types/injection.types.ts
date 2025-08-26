// ========== 依赖注入类型定义 ==========

import { Logger } from 'pino'

// 构造函数类型
export interface Constructor<T = {}> {
    new (...args: unknown[]): T
}

// 注入元数据类型
export interface InjectionMetadata {
    target: Constructor
    propertyKey: string
    parameterIndex?: number
    key: string
    createChildForLogger?: boolean
}

// 依赖注入容器接口
export interface DependencyContainer {
    [key: string]: unknown
}

// 装饰器参数类型
export interface DecoratorTarget {
    constructor: Constructor
}

// 参数索引映射
export interface ParameterIndexMap {
    [index: number]: string
}

// Logger 参数映射
export interface LoggerParameterMap {
    [index: number]: boolean
}

// 工厂方法类型
export type FactoryMethod<T = unknown> = (...args: unknown[]) => T

// 装饰器函数类型定义
export type PropertyDecorator = (target: unknown, propertyKey: string) => void
export type ParameterDecorator = (target: unknown, propertyKey: string, parameterIndex: number) => void
export type ClassDecorator<T extends Constructor> = (constructor: T) => T
export type MethodDecorator = (target: unknown, propertyKey: string, descriptor: PropertyDescriptor) => void

// 注入装饰器重载类型
export interface InjectedDecoratorOverloads {
    (key: string, createChildForLogger?: boolean): (target: unknown, propertyKey: string, parameterIndex?: number) => void
    (target: unknown, propertyKey: string): void
}

// 工厂注入函数类型
export type FactoryInjectionFunction<T> = (injection: DependencyContainer) => T
