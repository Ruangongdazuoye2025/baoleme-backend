# 认证服务使用示例

本文档演示如何在你的 Moleculer 微服务中使用认证服务。

## 认证服务

认证服务提供全面的用户认证和授权功能，包括用户注册、登录、密码管理和邮箱验证。

### 功能特性

- 带有邮箱验证的用户注册
- 带有密码验证的用户登录
- 通过邮件重置密码
- 带有旧密码验证的密码更新
- 带有验证的邮箱更新
- 基于令牌的认证
- 使用 bcrypt 的安全密码哈希
- 与邮件服务集成用于邮件通知
- 自动生成唯一用户名

### 依赖关系

- **Prisma Client**: 用于用户数据管理的数据库 ORM
- **Token Mixin**: JWT 令牌生成和验证
- **Mail Service**: 用于验证和通知的邮件发送
- **bcrypt**: 密码哈希和比较
- **Joi**: 请求验证

### 环境变量

确保设置以下环境变量：

```bash
# JWT 配置 (Token Mixin 使用)
JWT_SECRET=your-super-secure-jwt-secret-key

# 数据库配置 (Prisma 使用)
DATABASE_URL="your-database-connection-string"

# 密码配置
PASSWORD_MIN_LENGTH=6  # 最小密码长度 (可选，默认值在 auth.constants.ts 中)
SALT_ROUNDS=12        # bcrypt 盐值轮数 (可选，默认值在 auth.constants.ts 中)
```

## API 操作

### 1. 用户注册

使用邮箱和密码注册新用户。发送验证邮件。

```javascript
const result = await broker.call("auth.register", {
    email: "user@example.com",
    password: "securepassword123"
});

// 无返回值 - 验证邮件自动发送
```

**参数:**
- `email` (string, 必需): 有效的邮箱地址
- `password` (string, 必需): 符合最小长度要求的密码

**处理流程:**
1. 验证输入参数
2. 检查邮箱是否已存在
3. 使用 bcrypt 哈希密码
4. 在数据库中创建用户记录
5. 生成唯一用户名
6. 创建验证令牌
7. 通过邮件服务发送验证邮件

### 2. 用户登录

使用邮箱和密码验证用户。

```javascript
const result = await broker.call("auth.login", {
    email: "user@example.com",
    password: "securepassword123"
});

console.log(result);
// 输出:
// {
//     token: "jwt_access_token_here",
//     id: "user_id_here"
// }
```

**参数:**
- `email` (string, 必需): 用户的邮箱地址
- `password` (string, 必需): 用户的密码

**返回值:**
- `token` (string): 用于认证的 JWT 访问令牌
- `id` (string): 用户 ID

**要求:**
- 用户必须已验证 (`isVerified: true`)
- 密码必须与存储的哈希值匹配

### 3. 验证注册

使用邮件中的令牌验证用户邮箱。

```javascript
const result = await broker.call("auth.verifyRegister", {
    token: "verification_token_from_email"
});

console.log(result);
// 输出: 带有 isVerified: true 的更新用户对象
```

**参数:**
- `token` (string, 必需): 邮件中的验证令牌

**处理流程:**
1. 解码并验证验证令牌
2. 查找匹配 ID 的未验证用户
3. 更新用户记录设置 `isVerified: true`

### 4. 忘记密码

通过发送重置邮件启动密码重置流程。

```javascript
const result = await broker.call("auth.forgotPassword", {
    email: "user@example.com"
});

// 无返回值 - 重置邮件自动发送
```

**参数:**
- `email` (string, 必需): 用户的邮箱地址

**处理流程:**
1. 查找具有给定邮箱的已验证用户
2. 生成密码重置令牌
3. 通过邮件服务发送重置密码邮件

### 5. 重置密码

使用重置邮件中的令牌重置用户密码。

```javascript
const result = await broker.call("auth.resetPassword", {
    token: "reset_token_from_email",
    newPassword: "newsecurepassword123"
});

// 无返回值 - 密码在数据库中更新
```

**参数:**
- `token` (string, 必需): 邮件中的重置令牌
- `newPassword` (string, 必需): 符合最小长度要求的新密码

**处理流程:**
1. 解码并验证重置令牌
2. 查找匹配 ID 的已验证用户
3. 哈希新密码
4. 使用新密码哈希更新用户记录

### 6. 更新密码

更新用户密码（需要当前密码进行验证）。

```javascript
// 注意: 此操作需要认证上下文
const result = await broker.call("auth.updatePassword", {
    oldPassword: "currentpassword123",
    newPassword: "newsecurepassword123"
}, {
    meta: { currentUserId: "user_id_here" }
});

console.log(result);
// 输出:
// {
//     token: "new_jwt_access_token"
// }
```

**参数:**
- `oldPassword` (string, 必需): 用于验证的当前密码
- `newPassword` (string, 必需): 符合最小长度要求的新密码

**需要的 Meta 上下文:**
- `currentUserId` (string): 已认证用户的 ID

**返回值:**
- `token` (string): 新的 JWT 访问令牌（因为密码哈希已更改）

### 7. 更新邮箱

通过向新地址发送验证邮件启动邮箱更新流程。

```javascript
// 注意: 此操作需要认证上下文
const result = await broker.call("auth.updateEmail", {
    newEmail: "newemail@example.com"
}, {
    meta: { currentUserId: "user_id_here" }
});

// 无返回值 - 验证邮件发送到新地址
```

**参数:**
- `newEmail` (string, 必需): 新邮箱地址

**需要的 Meta 上下文:**
- `currentUserId` (string): 已认证用户的 ID

**处理流程:**
1. 生成邮箱更新令牌
2. 通过邮件服务向新地址发送验证邮件

### 8. 验证邮箱更新

使用验证邮件中的令牌完成邮箱更新流程。

```javascript
const result = await broker.call("auth.verifyEmail", {
    token: "email_update_token_from_email"
});

console.log(result);
// 输出: 带有新邮箱的更新用户对象
```

**参数:**
- `token` (string, 必需): 验证邮件中的邮箱更新令牌

**处理流程:**
1. 解码并验证邮箱更新令牌
2. 从令牌载荷中提取新邮箱
3. 使用新邮箱地址更新用户记录

### 9. 使用令牌认证

验证访问令牌，如果有效则返回用户 ID。

```javascript
const result = await broker.call("auth.authenticateWithToken", {
    token: "jwt_access_token"
});

console.log(result);
// 输出: "user_id_here" 或 "" (如果无效)
```

**参数:**
- `token` (string, 必需): JWT 访问令牌

**返回值:**
- `string`: 如果令牌有效返回用户 ID，无效返回空字符串

**验证流程:**
1. 解码访问令牌
2. 提取用户 ID 和密码哈希
3. 验证用户存在且已验证
4. 比较存储的密码哈希与令牌载荷
5. 如果所有检查通过则返回用户 ID

## 完整认证流程示例

### 1. 用户注册和验证流程

```javascript
// 步骤 1: 注册新用户
await broker.call("auth.register", {
    email: "newuser@example.com",
    password: "securepassword123"
});

// 步骤 2: 用户收到邮件并点击验证链接
// 步骤 3: 使用邮件中的令牌验证注册
const verifiedUser = await broker.call("auth.verifyRegister", {
    token: "verification_token_from_email"
});

// 步骤 4: 用户现在可以登录
const loginResult = await broker.call("auth.login", {
    email: "newuser@example.com",
    password: "securepassword123"
});

console.log("登录成功:", loginResult);
```

### 2. 密码重置流程

```javascript
// 步骤 1: 用户请求密码重置
await broker.call("auth.forgotPassword", {
    email: "user@example.com"
});

// 步骤 2: 用户收到邮件并点击重置链接
// 步骤 3: 使用邮件中的令牌重置密码
await broker.call("auth.resetPassword", {
    token: "reset_token_from_email",
    newPassword: "newpassword123"
});

// 步骤 4: 用户可以使用新密码登录
const loginResult = await broker.call("auth.login", {
    email: "user@example.com",
    password: "newpassword123"
});
```

### 3. 邮箱更新流程

```javascript
// 步骤 1: 已认证用户请求邮箱更新
await broker.call("auth.updateEmail", {
    newEmail: "newemail@example.com"
}, {
    meta: { currentUserId: "current_user_id" }
});

// 步骤 2: 用户在新地址收到邮件并点击验证链接
// 步骤 3: 使用令牌验证新邮箱
const updatedUser = await broker.call("auth.verifyEmail", {
    token: "email_update_token_from_email"
});

console.log("邮箱已更新:", updatedUser.email);
```

### 4. 中间件认证示例

```javascript
// 在 API 网关或中间件中
async function authenticateRequest(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
        return res.status(401).json({ error: '未提供令牌' });
    }
    
    const userId = await broker.call("auth.authenticateWithToken", { token });
    
    if (!userId) {
        return res.status(401).json({ error: '无效令牌' });
    }
    
    req.userId = userId;
    next();
}
```

## 错误处理

认证服务抛出带有适当状态码的 `MoleculerError`：

- **403 Forbidden**: 无效凭据、邮箱已存在、密码错误
- **400 Bad Request**: 无效输入参数（由 Joi 验证处理）

```javascript
try {
    const result = await broker.call("auth.login", {
        email: "user@example.com",
        password: "wrongpassword"
    });
} catch (error) {
    if (error.code === 403) {
        console.log("登录失败: 无效凭据");
    }
}
```

## 安全特性

- **密码哈希**: 使用可配置盐值轮数的 bcrypt
- **JWT 令牌**: 安全的基于令牌的认证
- **邮箱验证**: 防止未授权注册
- **密码验证**: 强制执行最小密码长度
- **令牌验证**: 包括密码哈希检查的全面令牌验证
- **事务安全**: 数据库操作包装在事务中
- **输入验证**: 所有输入的 Joi 模式验证

## 数据库模式要求

认证服务期望 User 模型具有以下字段：

```prisma
model User {
  id         String   @id @default(uuid())
  email      String   @unique
  password   String
  name       String?
  isVerified Boolean  @default(false)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
```

## 与其他服务集成

### 邮件服务集成

认证服务自动调用邮件服务操作：
- `mail.sendVerifyRegisterEmail`: 用于注册验证
- `mail.sendVerifyEmailEmail`: 用于邮箱更新验证  
- `mail.sendResetPasswordEmail`: 用于密码重置

### Token Mixin 集成

认证服务使用 Token Mixin 进行所有 JWT 操作：
- `generateAccessToken()`: 创建登录令牌
- `generateVerifyToken()`: 创建验证令牌
- `generateResetPasswordToken()`: 创建密码重置令牌
- `generateUpdateEmailToken()`: 创建邮箱更新令牌
- 各种解码方法用于令牌验证

## 最佳实践

1. **始终验证令牌**: 对受保护路由使用 `authenticateWithToken`
2. **优雅处理错误**: 提供用户友好的错误消息
3. **使用 HTTPS**: 确保所有认证流量加密
4. **令牌过期**: 实现令牌刷新机制
5. **速率限制**: 为登录尝试添加速率限制
6. **密码策略**: 强制执行强密码要求
7. **邮箱验证**: 新账户始终要求邮箱验证
8. **审计日志**: 记录认证事件以进行安全监控
