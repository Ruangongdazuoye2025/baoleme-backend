# 邮件服务使用示例

本文档演示如何在你的 Moleculer 微服务中使用邮件服务。

## 邮件服务

邮件服务使用 Nodemailer 和 SMTP 配置提供邮件发送功能。

### 功能特性

- 发送用户注册验证邮件
- 发送邮箱变更验证邮件
- 发送密码重置邮件
- 发送自定义HTML内容邮件
- 测试SMTP连接
- 基于环境变量的SMTP配置
- 启动时自动验证连接

### 环境变量

确保设置以下环境变量：

```bash
# SMTP 配置
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# 应用程序配置
BASE_URL=http://localhost:3000
APP_NAME=Your App Name
```

## 使用示例

### 1. 发送注册验证邮件

```javascript
const result = await broker.call("mail.sendVerifyRegisterEmail", {
    email: "user@example.com",
    token: "jwt_verification_token"
});

console.log(result);
// 输出:
// {
//     success: true,
//     messageId: "<message-id@smtp.server>",
//     message: "Verification email sent successfully"
// }
```

### 2. 发送邮箱变更验证

```javascript
const result = await broker.call("mail.sendVerifyEmailEmail", {
    email: "newemail@example.com",
    token: "jwt_email_change_token"
});
```

### 3. 发送密码重置邮件

```javascript
const result = await broker.call("mail.sendResetPasswordEmail", {
    email: "user@example.com",
    token: "jwt_reset_password_token"
});
```

### 4. 发送自定义邮件

```javascript
const result = await broker.call("mail.sendCustomEmail", {
    to: "recipient@example.com",
    subject: "欢迎加入我们的平台",
    html: `
        <div>
            <h1>欢迎！</h1>
            <p>感谢您加入我们的平台。</p>
        </div>
    `,
    from: "Custom Sender <sender@example.com>" // 可选
});
```

### 5. 测试SMTP连接

```javascript
const result = await broker.call("mail.testConnection");

console.log(result);
// 输出（成功）:
// {
//     success: true,
//     message: "SMTP connection is working"
// }

// 输出（失败）:
// {
//     success: false,
//     message: "SMTP connection failed",
//     error: "Error details..."
// }
```

## 与认证服务集成

邮件服务设计为与认证服务无缝配合：

```javascript
// 认证服务使用邮件服务
export default {
    name: "auth",
    
    actions: {
        register: {
            async handler(ctx) {
                const { email, userId } = ctx.params;
                
                // 生成验证令牌
                const token = await this.actions.generateVerifyToken({ userId });
                
                // 发送验证邮件
                await ctx.call("mail.sendVerifyRegisterEmail", {
                    email,
                    token
                });
                
                return { success: true, message: "注册成功" };
            }
        }
    }
};
```

## 邮件模板

服务包含针对不同邮件类型的内置HTML模板：

### 注册验证邮件
- **主题**: "邮箱验证"
- **内容**: 带有验证按钮的欢迎消息
- **链接**: `/email-postprocess/verify-register?token=...`

### 邮箱变更验证
- **主题**: "邮箱验证" 
- **内容**: 邮箱地址验证消息
- **链接**: `/email-postprocess/verify-email?token=...`

### 密码重置邮件
- **主题**: "重置密码"
- **内容**: 带有重置按钮的密码重置请求
- **链接**: `/email-postprocess/reset-password?token=...`

## 服务配置

邮件服务自动从环境变量配置：

```typescript
settings: {
    smtpHost: process.env.SMTP_HOST || "localhost",
    smtpPort: Number(process.env.SMTP_PORT) || 587,
    smtpSecure: process.env.SMTP_SECURE === "true",
    smtpUser: process.env.SMTP_USER || "",
    smtpPassword: process.env.SMTP_PASSWORD || "",
    baseUrl: process.env.BASE_URL || "http://localhost:3000",
    appName: process.env.APP_NAME || "Application"
}
```

## 错误处理

服务包含全面的错误处理和日志记录：

```javascript
try {
    const result = await broker.call("mail.sendVerifyRegisterEmail", {
        email: "invalid-email",
        token: "token"
    });
} catch (error) {
    console.error("邮件发送失败:", error.message);
}
```

## SMTP 提供商配置

### Gmail
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password  # 使用应用专用密码，而非常规密码
```

### Outlook/Hotmail
```bash
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@outlook.com
SMTP_PASSWORD=your-password
```

### 自定义SMTP服务器
```bash
SMTP_HOST=mail.yourdomain.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@yourdomain.com
SMTP_PASSWORD=your-password
```

## 完整认证流程示例

以下是邮件服务如何与完整认证流程集成：

```javascript
// 1. 用户注册
const registerResult = await broker.call("auth.sendEmailVerification", {
    userId: "user123",
    email: "user@example.com"
});

// 2. 用户点击邮件链接并验证
const verifyResult = await broker.call("auth.verifyEmail", {
    token: "token_from_email_link"
});

// 3. 用户请求密码重置
const resetRequest = await broker.call("auth.requestPasswordReset", {
    userId: "user123",
    email: "user@example.com"
});

// 4. 用户点击重置链接并设置新密码
const resetResult = await broker.call("auth.resetPassword", {
    token: "reset_token_from_email",
    newPassword: "new_secure_password"
});

// 5. 用户请求邮箱变更
const emailUpdateRequest = await broker.call("auth.requestEmailUpdate", {
    userId: "user123",
    newEmail: "newemail@example.com"
});

// 6. 用户验证新邮箱
const emailUpdateResult = await broker.call("auth.confirmEmailUpdate", {
    token: "email_update_token"
});
```

## 安全考虑

1. **SMTP凭据**: 将SMTP凭据安全地存储在环境变量中
2. **应用专用密码**: 对Gmail使用应用专用密码而非常规密码
3. **令牌过期**: 所有邮件令牌默认1小时过期
4. **HTTPS**: 生产环境中邮件链接始终使用HTTPS
5. **速率限制**: 考虑为邮件发送操作实施速率限制

## 监控和日志

服务提供全面的日志记录：

- 带有收件人信息的成功邮件发送记录
- 启动时的SMTP连接状态
- 失败邮件尝试的错误详情
- 连接验证结果

## 故障排除

### 常见问题

1. **认证失败**: 检查SMTP凭据，Gmail使用应用专用密码
2. **连接超时**: 验证SMTP主机和端口配置
3. **无效收件人**: 确保邮箱地址格式正确
4. **HTML渲染**: 在不同邮件客户端测试邮件模板

### 测试

使用测试连接操作验证你的SMTP配置：

```javascript
const testResult = await broker.call("mail.testConnection");
if (!testResult.success) {
    console.error("SMTP配置问题:", testResult.error);
}
```
