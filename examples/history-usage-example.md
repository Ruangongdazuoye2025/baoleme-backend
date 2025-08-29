# History Service 使用示例

本文档说明如何使用重构后的 History 微服务，包括浏览历史和收藏功能。

## API 端点

### 浏览历史 API

#### 1. 获取店铺浏览历史

**GET** `/api/records/shops?p=0&pn=10`

获取当前用户的店铺浏览历史记录。

**查询参数:**
- `p` (可选): 页码，从0开始，默认为0
- `pn` (可选): 每页数量，1-100，默认为10

**响应:**
```json
[
  {
    "shop": {
      "id": "shop-uuid",
      "name": "餐厅名称",
      "description": "餐厅描述",
      "rating": 85,
      "deliveryPrice": 500
    },
    "createdAt": "2025-08-29T10:43:00.000Z"
  }
]
```

#### 2. 创建店铺浏览历史

**POST** `/api/records/shops/:id`

记录用户访问了指定店铺。

**参数:**
- `id` (路径参数): 店铺ID (UUID)

**响应:**
```json
{
  "shop": {
    "id": "shop-uuid",
    "name": "餐厅名称",
    "description": "餐厅描述"
  },
  "createdAt": "2025-08-29T10:43:00.000Z"
}
```

#### 3. 获取商品浏览历史

**GET** `/api/records/items?p=0&pn=10`

获取当前用户的商品浏览历史记录。

**查询参数:**
- `p` (可选): 页码，从0开始，默认为0
- `pn` (可选): 每页数量，1-100，默认为10

**响应:**
```json
[
  {
    "item": {
      "id": "item-uuid",
      "name": "商品名称",
      "price": 2500,
      "available": true
    },
    "createdAt": "2025-08-29T10:43:00.000Z"
  }
]
```

#### 4. 创建商品浏览历史

**POST** `/api/records/items/:id`

记录用户查看了指定商品。

**参数:**
- `id` (路径参数): 商品ID (UUID)

**响应:**
```json
{
  "item": {
    "id": "item-uuid",
    "name": "商品名称",
    "price": 2500
  },
  "createdAt": "2025-08-29T10:43:00.000Z"
}
```

#### 5. 删除店铺浏览历史

**DELETE** `/api/records/shops/:id`

删除指定店铺的浏览历史记录。

**参数:**
- `id` (路径参数): 店铺ID (UUID)

**响应:**
HTTP 204 No Content

#### 6. 删除商品浏览历史

**DELETE** `/api/records/items/:id`

删除指定商品的浏览历史记录。

**参数:**
- `id` (路径参数): 商品ID (UUID)

**响应:**
HTTP 204 No Content

### 收藏 API

#### 1. 获取店铺收藏列表

**GET** `/api/favorites/shops?p=0&pn=10`

获取当前用户收藏的店铺列表。

**查询参数:**
- `p` (可选): 页码，从0开始，默认为0
- `pn` (可选): 每页数量，1-100，默认为10

**响应:**
```json
[
  {
    "shop": {
      "id": "shop-uuid",
      "name": "餐厅名称",
      "description": "餐厅描述",
      "rating": 85
    },
    "createdAt": "2025-08-29T10:43:00.000Z"
  }
]
```

#### 2. 收藏店铺

**POST** `/api/favorites/shops/:id`

将指定店铺添加到收藏列表。

**参数:**
- `id` (路径参数): 店铺ID (UUID)

**响应:**
```json
{
  "shop": {
    "id": "shop-uuid",
    "name": "餐厅名称",
    "description": "餐厅描述"
  },
  "createdAt": "2025-08-29T10:43:00.000Z"
}
```

#### 3. 获取商品收藏列表

**GET** `/api/favorites/items?p=0&pn=10`

获取当前用户收藏的商品列表。

**查询参数:**
- `p` (可选): 页码，从0开始，默认为0
- `pn` (可选): 每页数量，1-100，默认为10

**响应:**
```json
[
  {
    "item": {
      "id": "item-uuid",
      "name": "商品名称",
      "price": 2500,
      "available": true
    },
    "createdAt": "2025-08-29T10:43:00.000Z"
  }
]
```

#### 4. 收藏商品

**POST** `/api/favorites/items/:id`

将指定商品添加到收藏列表。

**参数:**
- `id` (路径参数): 商品ID (UUID)

**响应:**
```json
{
  "item": {
    "id": "item-uuid",
    "name": "商品名称",
    "price": 2500
  },
  "createdAt": "2025-08-29T10:43:00.000Z"
}
```

#### 5. 获取店铺收藏详情

**GET** `/api/favorites/shops/:id`

获取指定店铺的收藏详情。

**参数:**
- `id` (路径参数): 店铺ID (UUID)

**响应:**
```json
{
  "shop": {
    "id": "shop-uuid",
    "name": "餐厅名称",
    "description": "餐厅描述"
  },
  "createdAt": "2025-08-29T10:43:00.000Z"
}
```

#### 6. 获取商品收藏详情

**GET** `/api/favorites/items/:id`

获取指定商品的收藏详情。

**参数:**
- `id` (路径参数): 商品ID (UUID)

**响应:**
```json
{
  "item": {
    "id": "item-uuid",
    "name": "商品名称",
    "price": 2500
  },
  "createdAt": "2025-08-29T10:43:00.000Z"
}
```

#### 7. 取消店铺收藏

**DELETE** `/api/favorites/shops/:id`

从收藏列表中移除指定店铺。

**参数:**
- `id` (路径参数): 店铺ID (UUID)

**响应:**
HTTP 204 No Content

#### 8. 取消商品收藏

**DELETE** `/api/favorites/items/:id`

从收藏列表中移除指定商品。

**参数:**
- `id` (路径参数): 商品ID (UUID)

**响应:**
HTTP 204 No Content

## 认证要求

所有 History API 端点都需要用户认证。请在请求头中包含有效的认证令牌：

```
Authorization: Bearer <your-token>
```

## 微服务调用

在其他服务中可以通过以下方式调用 history service：

```typescript
// 获取店铺浏览历史
const shopHistory = await ctx.call("history.getShopHistory", {
    p: 0,
    pn: 10
}, {
    meta: { currentUserId: "user-uuid" }
});

// 创建店铺浏览历史
const newShopHistory = await ctx.call("history.createShopHistory", {
    id: "shop-uuid"
}, {
    meta: { currentUserId: "user-uuid" }
});

// 获取商品收藏列表
const itemFavourites = await ctx.call("history.getItemFavourite", {
    p: 0,
    pn: 20
}, {
    meta: { currentUserId: "user-uuid" }
});

// 收藏商品
const newItemFavourite = await ctx.call("history.createItemFavourite", {
    id: "item-uuid"
}, {
    meta: { currentUserId: "user-uuid" }
});

// 删除店铺收藏
await ctx.call("history.deleteShopFavourite", {
    id: "shop-uuid"
}, {
    meta: { currentUserId: "user-uuid" }
});
```

## 注意事项

1. 所有需要用户身份的操作都通过 `ctx.meta.currentUserId` 获取当前用户ID
2. History service 会调用 `item.get` 和 `shop.get` 服务来获取商品和店铺详情
3. 店铺收藏信息会调用 `shop.getFullShopInfo` 来获取完整的店铺信息
4. 分页参数 `p` 和 `pn` 会自动转换为 `skip` 和 `take` 参数
5. 历史记录和收藏记录使用 upsert 操作，重复访问会更新时间
6. 删除操作会验证记录类型（HISTORY 或 FAVORITE）确保数据一致性
7. 参数验证使用 Joi Schema 进行，错误时返回标准的 ValidationError
