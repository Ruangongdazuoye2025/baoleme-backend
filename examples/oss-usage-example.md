# OSS 服务使用示例

这个 OSS 服务基于 Moleculer 微服务框架和 MinIO 客户端实现，提供了基础的对象存储功能。

## 环境变量配置

在使用前，请确保配置以下环境变量：

```bash
OSS_ENDPOINT=localhost
OSS_PORT=9000
OSS_USE_SSL=false
OSS_ACCESS_KEY=your-access-key
OSS_SECRET_KEY=your-secret-key
OSS_BUCKET_NAME=your-bucket-name
```

## Service Actions

当前 OSS 服务提供以下 4 个基础操作：

### 1. existsObject - 检查对象是否存在

检查指定的对象是否存在于存储桶中。

**调用方式：**
```javascript
const exists = await broker.call("oss.existsObject", {}, {
    meta: {
        objectName: "path/to/my-file.jpg"
    }
});
console.log("Object exists:", exists); // true or false
```

**参数：**
- `params`: 空对象 `{}`
- `meta.objectName`: 对象名称/路径

**返回值：**
- `boolean`: 对象存在返回 `true`，不存在返回 `false`

### 2. getObjectUrl - 获取对象的预签名URL

获取指定对象的预签名 URL，用于临时访问文件。

**调用方式：**
```javascript
const url = await broker.call("oss.getObjectUrl", {}, {
    meta: {
        objectName: "path/to/my-file.jpg"
    }
});
console.log("Object URL:", url);
```

**参数：**
- `params`: 空对象 `{}`
- `meta.objectName`: 对象名称/路径

**返回值：**
- `string`: 预签名的访问 URL

### 3. putObject - 上传对象

上传数据到指定的对象路径，并返回访问 URL。

**调用方式：**
```javascript
// 上传 Buffer 数据
const buffer = Buffer.from("Hello, World!");
const url = await broker.call("oss.putObject", buffer, {
    meta: {
        objectName: "uploads/hello.txt",
        contentType: "text/plain"
    }
});
console.log("Uploaded file URL:", url);

// 上传流数据
const fs = require('fs');
const stream = fs.createReadStream('/path/to/local/file.jpg');
const url = await broker.call("oss.putObject", stream, {
    meta: {
        objectName: "uploads/image.jpg",
        contentType: "image/jpeg"
    }
});
```

**参数：**
- `params`: 要上传的数据（Buffer、Stream 或 String）
- `meta.objectName`: 对象名称/路径
- `meta.contentType`: 内容类型（可选）

**返回值：**
- `string`: 上传成功后的访问 URL

### 4. removeObject - 删除对象

删除指定的对象。

**调用方式：**
```javascript
await broker.call("oss.removeObject", {}, {
    meta: {
        objectName: "path/to/file-to-delete.jpg"
    }
});
console.log("Object removed successfully");
```

**参数：**
- `params`: 空对象 `{}`
- `meta.objectName`: 要删除的对象名称/路径

**返回值：**
- `void`: 无返回值

## 完整使用示例

### 文件上传和管理流程

```javascript
const fs = require('fs');

// 1. 检查文件是否已存在
const objectName = "uploads/avatar-123.jpg";
const exists = await broker.call("oss.existsObject", {}, {
    meta: { objectName }
});

if (exists) {
    console.log("File already exists");
} else {
    // 2. 上传新文件
    const fileBuffer = fs.readFileSync('/local/path/to/avatar.jpg');
    const uploadUrl = await broker.call("oss.putObject", fileBuffer, {
        meta: {
            objectName,
            contentType: "image/jpeg"
        }
    });
    console.log("File uploaded:", uploadUrl);
}

// 3. 获取访问 URL
const accessUrl = await broker.call("oss.getObjectUrl", {}, {
    meta: { objectName }
});
console.log("Access URL:", accessUrl);

// 4. 删除文件（如果需要）
// await broker.call("oss.removeObject", {}, {
//     meta: { objectName }
// });
```

### 在 API Gateway 中使用

如果你使用 `moleculer-web` 作为 API Gateway，可以这样创建文件上传接口：

```javascript
// routes/upload.js
module.exports = {
    path: "/api/upload",
    
    aliases: {
        "POST /": "multipart:upload.create"
    },
    
    mappingPolicy: "restrict",
    
    bodyParsers: {
        json: false,
        urlencoded: false
    },
    
    busboyConfig: {
        limits: {
            files: 1,
            fileSize: 10 * 1024 * 1024 // 10MB
        }
    }
};

// services/upload.service.js
module.exports = {
    name: "upload",
    
    actions: {
        create: {
            async handler(ctx) {
                try {
                    const { file } = ctx.params;
                    
                    if (!file) {
                        throw new Error("No file provided");
                    }
                    
                    // 生成唯一文件名
                    const timestamp = Date.now();
                    const objectName = `uploads/${timestamp}-${file.filename}`;
                    
                    // 上传到 OSS
                    const url = await ctx.call("oss.putObject", file, {
                        meta: {
                            objectName,
                            contentType: file.mimetype
                        }
                    });
                    
                    return {
                        success: true,
                        url,
                        filename: file.filename,
                        objectName
                    };
                    
                } catch (error) {
                    throw new Error(`Upload failed: ${error.message}`);
                }
            }
        }
    }
};
```

## 错误处理

所有的 OSS 操作都可能抛出错误，建议使用 try-catch 进行错误处理：

```javascript
try {
    const url = await broker.call("oss.putObject", fileBuffer, {
        meta: {
            objectName: "test.jpg",
            contentType: "image/jpeg"
        }
    });
    console.log("Success:", url);
} catch (error) {
    console.error("Upload failed:", error.message);
}
```

## 配置说明

### MinIO 服务器设置

确保你的 MinIO 服务器正在运行，并且存储桶已经创建：

```bash
# 使用 Docker 运行 MinIO
docker run -p 9000:9000 -p 9001:9001 \
  -e "MINIO_ROOT_USER=your-access-key" \
  -e "MINIO_ROOT_PASSWORD=your-secret-key" \
  minio/minio server /data --console-address ":9001"
```

### 存储桶权限

确保配置的存储桶具有适当的访问权限，特别是如果需要公共访问。

## 注意事项

1. **存储桶**: 服务不会自动创建存储桶，请确保 `OSS_BUCKET_NAME` 指定的存储桶已存在
2. **对象命名**: 建议使用类似文件路径的命名方式，如 `uploads/2024/01/file.jpg`
3. **内容类型**: 上传文件时指定正确的 `contentType` 有助于浏览器正确处理文件
4. **URL有效期**: 预签名URL的有效期由 MinIO 服务器默认配置决定
5. **数据类型**: `putObject` 支持 Buffer、Stream 和 String 类型的数据
6. **元数据传递**: 所有操作都通过 `ctx.meta` 传递对象名称和其他元数据

## 限制

当前实现的限制：
- 不支持自定义存储桶操作（所有操作都使用配置的默认存储桶）
- 不支持列出对象
- 不支持获取对象元数据
- 不支持自定义 URL 有效期
- 不支持分片上传

如需扩展功能，请修改服务代码添加相应的 actions。
