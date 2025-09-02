# 集成测试指南

本项目使用 Jest 和 Supertest 进行集成测试。

## 安装依赖

```bash
npm install --save-dev supertest @types/supertest jest @types/jest ts-jest
```

## 配置

### 环境变量

- `BASE_URL`: 测试目标服务的基础URL (默认: http://localhost:3000)
- `PORT`: 服务端口 (默认: 3000)
- `NODE_ENV`: 环境类型 (test)
- `LOG_LEVEL`: 日志级别 (error)

### Jest 配置

Jest 配置位于 `jest.config.js` 文件中，主要配置：

- 使用 ts-jest 预设处理 TypeScript
- 测试文件位于 `tests/` 目录
- 支持 `.test.ts` 和 `.spec.ts` 文件
- 30秒测试超时
- 覆盖率报告

## 运行测试

### 运行所有测试
```bash
npm test
```

### 运行集成测试
```bash
npm run test:integration
```

### 运行集成测试 (监听模式)
```bash
npm run test:integration:watch
```

## 编写测试

### 基本结构

```typescript
import request from 'supertest';
import dotenv from 'dotenv';

// 加载测试环境变量
dotenv.config();

describe('Service Name Integration Tests', () => {
    const baseURL = process.env.BASE_URL || 'http://localhost:3000';
    
    beforeAll(() => {
        console.log('Testing against:', baseURL);
    });

    describe('GET /api/endpoint', () => {
        it('should return expected response', async () => {
            const response = await request(baseURL)
                .get('/api/endpoint')
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toEqual({
                // 期望的响应结构
            });
        });
    });
});
```

### 测试示例

参考 `tests/integrated/hello.test.ts` 文件，该文件测试了：

- ✅ 正常响应返回
- ✅ 状态码验证
- ✅ 响应结构验证
- ✅ 错误处理

## 最佳实践

1. **环境隔离**: 使用独立的测试环境变量
2. **清理数据**: 在测试后清理创建的数据
3. **异步处理**: 正确处理异步操作和Promise
4. **错误测试**: 测试各种错误场景
5. **超时设置**: 为长时间操作设置合适的超时

## 测试服务前的准备

在运行集成测试前，确保：

1. 目标服务正在运行 (如 http://localhost:3000)
2. 所有依赖服务已启动 (数据库、NATS等)
3. 环境变量配置正确
4. 测试数据已准备

## 故障排除

### 连接错误
- 检查 `BASE_URL` 配置
- 确认目标服务正在运行
- 验证网络连接

### 超时错误
- 增加测试超时时间 (在 jest.config.js 中)
- 检查服务响应时间
- 验证服务健康状态

### 权限错误
- 检查认证配置
- 验证测试用户权限
- 确认API密钥设置
