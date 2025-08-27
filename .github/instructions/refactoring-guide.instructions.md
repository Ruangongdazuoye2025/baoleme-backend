# 单体应用向 Moleculer 微服务架构重构指导

如果用户正在考虑将现有的单体应用程序迁移到微服务架构，请遵循本文档的指导为用户提供帮助。

## 概述

本文档基于 Auth 模块的重构经验，提供了从 Express 单体应用程序重构为 Moleculer 微服务架构的详细指导。

## 重构前架构特点

**单体应用结构：**
- **Controller**: Express Router + 中间件处理 HTTP 请求
- **Service**: 业务逻辑类，使用依赖注入
- **依赖注入**: 基于装饰器的 IoC 容器
- **验证**: Express 中间件进行参数验证
- **认证**: Express 中间件处理身份验证
- **错误处理**: 自定义 ResponseError 类

## 重构后架构特点

**微服务架构：**
- **API Gateway**: Moleculer Web + API Auth Mixin
- **Service**: Moleculer ServiceSchema 定义
- **Mixin**: 可复用的功能模块
- **验证**: Joi Schema 集成到 action params
- **认证**: API Auth Mixin 统一处理
- **错误处理**: Moleculer 标准错误类型

## 核心重构步骤

### 1. 服务层重构

#### 1.1 从 Class 转换为 ServiceSchema

**重构前 (Class):**
```typescript
// service/auth.service.ts (单体应用)
@classInjection
export default class AuthService {
    @injected
    private prisma!: PrismaClient
    
    async register(email: string, password: string) {
        // 业务逻辑
    }
}
```

**重构后 (ServiceSchema):**
```typescript
// services/auth.service.ts (微服务)
const AuthService: ServiceSchema = {
    name: "auth",
    mixins: [TokenMixin],
    
    actions: {
        register: {
            params: emailPasswordRequestSchema as any,
            async handler(ctx: Context<EmailPasswordRequest>) {
                // 业务逻辑
            }
        }
    },
    
    created() {
        this.prisma = new PrismaClient()
    }
};
```

#### 1.2 依赖管理转换

| 重构前 | 重构后 |
|--------|--------|
| `@injected` 装饰器注入 | `mixins` 数组或 `created()` 生命周期 |
| IoC 容器管理依赖 | Moleculer 服务调用 `ctx.call()` |
| 类成员变量 | 服务实例属性 `this.xxx` |

#### 1.3 参数验证迁移

##### Schema 定义迁移

**重构前 (单独的 Schema 文件):**
```typescript
// schema/auth.schema.ts
import Joi from 'joi'

export const registerLogin = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required()
})

export const updateEmail = Joi.object({
    newEmail: Joi.string().email().required()
})

export const updatePassword = Joi.object({
    oldPassword: Joi.string().min(6).required(),
    newPassword: Joi.string().min(6).required()
})

export const verifyToken = Joi.object({
    token: Joi.string().required()
})

export const resetPassword = Joi.object({
    token: Joi.string().required(),
    newPassword: Joi.string().min(6).required()
})

// TypeScript 类型定义
export interface RegisterLogin {
    email: string;
    password: string;
}

export interface UpdateEmail {
    newEmail: string;
}

export interface UpdatePassword {
    oldPassword: string;
    newPassword: string;
}

export interface VerifyToken {
    token: string;
}

export interface ResetPassword {
    token: string;
    newPassword: string;
}
```

**重构后 (Service 内部定义):**
```typescript
// services/auth.service.ts
import Joi from "joi";
import * as DEFAULTS from "../common/auth.constants";

// Joi Schema 定义
const emailPasswordRequestSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(DEFAULTS.PASSWORD_MIN_LENGTH).required()
});

const updateEmailRequestSchema = Joi.object({
    newEmail: Joi.string().email().required()
});

const updatePasswordRequestSchema = Joi.object({
    oldPassword: Joi.string().min(DEFAULTS.PASSWORD_MIN_LENGTH).required(),
    newPassword: Joi.string().min(DEFAULTS.PASSWORD_MIN_LENGTH).required()
});

const tokenRequestSchema = Joi.object({
    token: Joi.string().required()
});

const tokenPasswordRequestSchema = Joi.object({
    token: Joi.string().required(),
    newPassword: Joi.string().min(DEFAULTS.PASSWORD_MIN_LENGTH).required()
});

// TypeScript Interface 定义
interface EmailPasswordRequest {
    email: string;
    password: string;
}

interface UpdateEmailRequest {
    newEmail: string;
}

interface UpdatePasswordRequest {
    oldPassword: string;
    newPassword: string;
}

interface TokenRequest {
    token: string;
}

interface TokenPasswordRequest {
    token: string;
    newPassword: string;
}
```

##### Controller/Action 验证迁移

**重构前 (Express 中间件验证):**
```typescript
// controller/auth.controller.ts
import { validateBody } from '../middleware/validator.middleware'
import * as AuthSchema from '../schema/auth.schema'

router.post('/auth/register',
    validateBody(AuthSchema.registerLogin),  // 中间件验证
    async (req, res) => {
        const { email, password } = req.body as AuthSchema.RegisterLogin  // 类型断言
        await authService.register(email, password)
        res.status(HTTP_STATUS.NO_CONTENT).send()
    }
)

router.post('/auth/update-email',
    authMiddleware.requireAuth(),
    validateBody(AuthSchema.updateEmail),  // 中间件验证
    async (req, res) => {
        const { newEmail } = req.body as AuthSchema.UpdateEmail  // 类型断言
        await authService.updateEmail(req.user!.id, newEmail)
        res.status(HTTP_STATUS.NO_CONTENT).send()
    }
)
```

**重构后 (Action 内置验证):**
```typescript
// services/auth.service.ts
const AuthService: ServiceSchema = {
    actions: {
        register: {
            params: emailPasswordRequestSchema as any,  // 内置验证
            async handler(ctx: Context<EmailPasswordRequest>) {  // 强类型
                const { email, password } = ctx.params  // 自动类型推断
                // 验证已在 Moleculer 框架层完成
                return await (this.prisma as PrismaClient).$transaction(async tx => {
                    // 业务逻辑
                })
            }
        },
        
        updateEmail: {
            params: updateEmailRequestSchema as any,  // 内置验证
            async handler(ctx: Context<UpdateEmailRequest, { currentUserId: string }>) {  // 强类型
                const { currentUserId } = ctx.meta  // 从认证中间件获取
                const { newEmail } = ctx.params  // 自动类型推断
                const token = this.generateUpdateEmailToken(currentUserId, newEmail)
                await ctx.call("mail.sendVerifyEmailEmail", { email: newEmail, token }, { parentCtx: ctx })
            }
        }
    }
}
```

##### 验证配置对比

**重构前的验证流程:**
```typescript
// middleware/validator.middleware.ts (单体应用)
export const validateBody = (schema: Joi.Schema) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const { error } = schema.validate(req.body)
        if (error) {
            return res.status(400).json({ 
                error: error.details[0].message 
            })
        }
        next()
    }
}

// 使用流程：HTTP 请求 → 中间件验证 → Controller → Service
```

**重构后的验证流程:**
```typescript
// Moleculer 自动验证流程 (微服务框架)：
// HTTP 请求 → API Gateway → Moleculer 框架验证 → Service Action

// 验证失败时自动返回标准错误响应：
{
    "name": "ValidationError",
    "message": "Parameters validation error!",
    "code": 422,
    "type": "VALIDATION_ERROR",
    "data": [
        {
            "field": "email",
            "message": "\"email\" must be a valid email",
            "type": "string.email"
        }
    ]
}
```

##### 迁移要点总结

| 方面 | 重构前 | 重构后 |
|------|--------|--------|
| **Schema 位置** | 独立的 schema 文件 | Service 文件内部定义 |
| **验证时机** | Express 中间件 | Moleculer Action 参数 |
| **类型安全** | 手动类型断言 | 泛型自动推断 |
| **错误处理** | 自定义中间件处理 | Moleculer 标准错误 |
| **代码复用** | 多个 Controller 共享 Schema | 每个 Service 独立 Schema |
| **常量引用** | 硬编码或独立常量文件 | 通过 `DEFAULTS` 常量文件 |

### 2. 共享功能提取为 Mixin

#### 2.1 识别可提取的功能

重构时应将以下功能提取为 Mixin：
- **通用工具类** (如 TokenService) → Token Mixin
- **认证逻辑** → API Auth Mixin
- **数据库适配器** → DB Mixin
- **缓存功能** → Cache Mixin

#### 2.2 Mixin 设计原则

**Token Mixin 示例:**
```typescript
// mixins/token.mixin.ts (微服务)
const TokenMixin: ServiceSchema = {
    name: "token",
    
    settings: {
        jwtSecret: process.env.JWT_SECRET || "default-secret"
    },
    
    methods: {  // 私有方法，不暴露为 action
        generateAccessToken(userId: string, password: string): string {
            return jwt.sign({sub: userId, pwd: password}, this.settings.jwtSecret, {expiresIn: '100d'});
        }
    }
};
```

**设计要点：**
- 使用 `methods` 而非 `actions` 保持封装性
- 通过 `settings` 管理配置
- 提供清晰的接口方法

### 3. API Gateway 重构

#### 3.1 路由映射策略

**认证要求分离:**
```typescript
// services/api.service.ts (微服务)
routes: [
    // 需要认证的路由
    {
        path: "/api",
        mappingPolicy: "restrict", 
        authorization: true,  // 关键：需要认证
        aliases: {
            "POST /auth/update-email": "auth.updateEmail",
            "POST /auth/update-password": "auth.updatePassword",
        }
    }
]
```

#### 3.2 认证中间件迁移

**重构前 (Express 中间件):**
```typescript
// controller/auth.controller.ts (单体应用)
router.post('/auth/update-email',
    authMiddleware.requireAuth(),  // Express 中间件
    async (req, res) => {
        const userId = req.user!.id  // 从 req.user 获取
    }
)
```

**重构后 (API Auth Mixin):**
```typescript
// mixins/api-auth.mixin.ts (微服务)
// API Auth Mixin
methods: {
    async authorize(ctx, route, req, res) {
        // 验证 Bearer token
        const token = auth.slice(7);
        const id = await ctx.call("auth.authenticateWithToken", { token })
        ctx.meta.currentUserId = id;  // 设置到 context meta
    }
}

// services/auth.service.ts (微服务)
// Service Action
async handler(ctx: Context<UpdateEmailRequest, { currentUserId: string }>) {
    const { currentUserId } = ctx.meta  // 从 context meta 获取
}
```

### 4. 服务间通信重构

#### 4.1 从直接调用到服务调用

**重构前 (直接调用):**
```typescript
// service/auth.service.ts (单体应用)
class AuthService {
    @injected
    private mailService!: MailService
    
    async register(email: string, password: string) {
        await this.mailService.sendVerifyRegisterEmail(email, token)  // 直接调用
    }
}
```

**重构后 (服务调用):**
```typescript
// services/auth.service.ts (微服务)
const AuthService: ServiceSchema = {
    actions: {
        register: {
            async handler(ctx: Context<EmailPasswordRequest>) {
                await ctx.call("mail.sendVerifyRegisterEmail", { email, token }, { parentCtx: ctx })  // 服务调用
            }
        }
    }
}
```

#### 4.2 错误处理转换

**重构前:**
```typescript
// util/errors.ts (单体应用)
throw new ResponseError(403, 'Email already exists')
```

**重构后:**
```typescript
// services/auth.service.ts (微服务)
throw new Errors.MoleculerError('Email already exists', 403)
```

### 5. 配置管理重构

#### 5.1 环境变量管理

**重构前 (全局访问):**
```typescript
// service/mail.service.ts (单体应用)
private transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,  // 直接访问
    port: Number(process.env.SMTP_PORT),
});
```

**重构后 (Service Settings):**
```typescript
// services/mail.service.ts (微服务)
const MailService: ServiceSchema = {
    settings: {
        smtpHost: process.env.SMTP_HOST || "localhost",  // 集中管理
        smtpPort: Number(process.env.SMTP_PORT) || 587,
    },
    
    created() {
        this.transporter = nodemailer.createTransport({
            host: this.settings.smtpHost,  // 通过 settings 访问
            port: this.settings.smtpPort,
        });
    }
}
```

### 6. 数据库集成重构

#### 6.1 Prisma 客户端管理

**重构前 (依赖注入):**
```typescript
// service/auth.service.ts (单体应用)
@classInjection
export default class AuthService {
    @injected
    private prisma!: PrismaClient  // 自动注入
}
```

**重构后 (生命周期管理):**
```typescript
// services/auth.service.ts (微服务)
const AuthService: ServiceSchema = {
    created() {
        this.prisma = new PrismaClient()  // 手动创建
    },
    
    async handler(ctx: Context) {
        return await (this.prisma as PrismaClient).$transaction(async tx => {
            // 使用 this.prisma
        })
    }
}
```

## 重构清单

### 准备阶段
- [ ] 分析现有服务的依赖关系
- [ ] 识别可提取的通用功能
- [ ] 设计服务拆分策略
- [ ] 准备 Moleculer 项目结构

### Service 重构
- [ ] 将 Class 转换为 ServiceSchema
- [ ] 迁移业务逻辑到 actions
- [ ] 集成参数验证到 action params
- [ ] 转换错误处理机制
- [ ] 迁移配置到 settings

### Mixin 开发
- [ ] 提取通用功能为 Mixin
- [ ] 使用 methods 而非 actions
- [ ] 配置管理优化
- [ ] 生命周期事件处理

### API Gateway 配置
- [ ] 设计路由映射
- [ ] 分离认证和非认证路由
- [ ] 实现认证 Mixin
- [ ] 配置严格映射模式

### 服务间通信
- [ ] 替换直接调用为 ctx.call()
- [ ] 处理异步服务调用
- [ ] 实现错误传播机制
- [ ] 优化调用性能

### 测试和验证
- [ ] 单元测试迁移
- [ ] 集成测试更新
- [ ] 性能基准测试
- [ ] 错误场景验证

## 注意事项

1. **渐进式重构**: 不要一次性重构所有模块，按功能模块逐步进行
2. **保持接口兼容**: API 接口保持不变，确保客户端无需修改
3. **错误处理一致性**: 统一使用 Moleculer 错误处理机制
4. **配置集中化**: 通过 settings 管理所有配置项
5. **服务边界清晰**: 每个服务职责单一，避免循环依赖
6. **文档同步更新**: 及时更新 API 文档和使用示例

## 后续模块重构建议

基于 Auth 模块的重构经验，其他模块重构时应：

1. **优先重构独立模块**: 选择依赖较少的模块先重构
2. **共享 Mixin 复用**: 复用已有的 Token、Auth 等 Mixin
3. **统一错误处理**: 使用相同的错误处理模式
4. **保持 API 一致性**: 维护统一的 API 设计风格
5. **文档驱动开发**: 先更新文档，再进行代码重构

通过遵循这份指导，可以确保重构过程的一致性和质量，降低重构风险，提高开发效率。
