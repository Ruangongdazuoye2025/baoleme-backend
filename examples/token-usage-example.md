# Token Mixin 使用示例

本文档演示如何在你的 Moleculer 微服务中使用 Token Mixin。

## Token Mixin

Token Mixin 为认证和授权目的提供 JWT 令牌操作。

### 功能特性

- 为用户认证生成访问令牌
- 为邮箱验证生成验证令牌
- 生成密码重置令牌
- 生成邮箱更新令牌
- 解码和验证所有令牌类型
- 内置令牌过期处理
- 基于环境变量的 JWT 密钥配置

### 环境变量

确保设置以下环境变量：

```bash
JWT_SECRET=your-super-secure-jwt-secret-key
```

## 使用示例

### 1. 基础令牌操作

```javascript
// 生成访问令牌
const accessToken = await broker.call("auth.generateAccessToken", {
    userId: "user123",
    password: "hashed_password"
});

// 生成验证令牌
const verifyToken = await broker.call("auth.generateVerifyToken", {
    userId: "user123"
});

// 解码验证令牌
const decoded = await broker.call("auth.decodeVerifyToken", {
    token: verifyToken
});
```

### 2. 邮箱验证流程

```javascript
// 步骤 1: 发送邮箱验证
const result = await broker.call("auth.sendEmailVerification", {
    userId: "user123"
});

// 步骤 2: 使用令牌验证邮箱（来自邮件链接）
const verification = await broker.call("auth.verifyEmail", {
    token: "jwt_token_from_email"
});
```

### 3. 密码重置流程

```javascript
// 步骤 1: 请求密码重置
const resetRequest = await broker.call("auth.requestPasswordReset", {
    userId: "user123"
});

// 步骤 2: 使用令牌重置密码
const resetResult = await broker.call("auth.resetPassword", {
    token: "jwt_token_from_email",
    newPassword: "new_secure_password"
});
```

### 4. 邮箱更新流程

```javascript
// 步骤 1: 请求邮箱更新
const updateRequest = await broker.call("auth.requestEmailUpdate", {
    userId: "user123",
    newEmail: "newemail@example.com"
});

// 步骤 2: 使用令牌确认邮箱更新
const updateResult = await broker.call("auth.confirmEmailUpdate", {
    token: "jwt_token_from_new_email"
});
```

### 5. 用户登录

```javascript
// 用户登录并获取访问令牌
const loginResult = await broker.call("auth.login", {
    userId: "user123",
    password: "user_password"
});

console.log(loginResult);
// 输出:
// {
//     success: true,
//     accessToken: "jwt_access_token",
//     expiresIn: "100d"
// }
```

## 令牌类型和过期时间

| 令牌类型 | 用途 | 过期时间 | 载荷 |
|------------|---------|------------|---------|
| 访问令牌 | 用户认证 | 100天 | `{ sub: userId, pwd: password }` |
| 验证令牌 | 邮箱验证 | 1小时 | `{ sub: userId, verify: true }` |
| 重置密码令牌 | 密码重置 | 1小时 | `{ sub: userId, resetPassword: true }` |
| 更新邮箱令牌 | 邮箱更新 | 1小时 | `{ sub: userId, email: newEmail }` |

## 使用 Token Mixin 创建你自己的服务

```typescript
import { ServiceBroker, Context } from "moleculer";
import TokenMixin from "../mixins/token.mixin";

export default {
    name: "my-auth-service",
    
    // 包含 token mixin
    mixins: [TokenMixin],

    actions: {
        // 你的自定义操作
        customAction: {
            async handler(ctx: Context) {
                // 使用 token mixin 操作
                const token = await this.actions.generateAccessToken({
                    userId: "123",
                    password: "hashed_pwd"
                });
                
                return { token };
            }
        }
    }
};
```

## 安全考虑

1. **JWT 密钥**: 生产环境中始终使用强而唯一的 JWT 密钥
2. **令牌存储**: 在客户端安全地存储令牌
3. **令牌传输**: 传输令牌时始终使用 HTTPS
4. **令牌验证**: 处理请求前始终验证令牌
5. **令牌撤销**: 考虑为注销功能实现令牌黑名单

## 错误处理

所有解码方法对于无效或过期的令牌返回 `null`。始终检查返回值：

```javascript
const decoded = await broker.call("auth.decodeVerifyToken", { token });

if (!decoded) {
    // 令牌无效或已过期
    throw new Error("无效的验证令牌");
}

// 令牌有效，继续执行逻辑
console.log("用户ID:", decoded.sub);
```

## 与其他服务集成

Token Mixin 可以轻松与你的 Moleculer 生态系统中的其他服务集成：

```javascript
// 在你的用户服务中
export default {
    name: "user",
    
    actions: {
        register: {
            async handler(ctx) {
                // 创建用户逻辑...
                
                // 发送验证邮件
                await ctx.call("auth.sendEmailVerification", {
                    userId: newUser.id
                });
                
                return { success: true };
            }
        }
    }
};
```
