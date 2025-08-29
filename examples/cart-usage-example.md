# Cart Service 使用示例

本文档说明如何使用重构后的 Cart 微服务。

## API 端点

### 1. 获取购物车商品数量

**GET** `/api/cart/:shopId/item/:itemId`

获取指定商品在购物车中的数量。

**参数:**
- `shopId` (路径参数): 店铺ID (UUID)
- `itemId` (路径参数): 商品ID (UUID)

**响应:**
```json
{
  "quantity": 2
}
```

### 2. 更新购物车商品数量

**PATCH** `/api/cart/:shopId/item/:itemId`

更新指定商品在购物车中的数量。当数量为0时，从购物车中移除该商品。

**参数:**
- `shopId` (路径参数): 店铺ID (UUID)
- `itemId` (路径参数): 商品ID (UUID)
- `quantity` (请求体): 商品数量 (非负整数)

**请求体:**
```json
{
  "quantity": 3
}
```

**响应:**
```json
{
  "quantity": 3,
  "cart": {
    "total": 150,
    "totalWithoutPromotion": 200,
    "settlable": true
  }
}
```

### 3. 获取购物车信息

**GET** `/api/cart/:id`

获取指定店铺的购物车汇总信息。

**参数:**
- `id` (路径参数): 店铺ID (UUID)

**响应:**
```json
{
  "total": 150,
  "totalWithoutPromotion": 200,
  "settlable": true
}
```

### 4. 获取购物车商品列表

**GET** `/api/cart/:id/items`

获取指定店铺购物车中的所有商品详情。

**参数:**
- `id` (路径参数): 店铺ID (UUID)

**响应:**
```json
[
  {
    "item": {
      "id": "item-uuid",
      "name": "商品名称",
      "price": 50,
      "available": true,
      "stockout": false
    },
    "quantity": 2
  },
  {
    "item": {
      "id": "item-uuid-2",
      "name": "商品名称2",
      "price": 100,
      "available": true,
      "stockout": false
    },
    "quantity": 1
  }
]
```

### 5. 清空购物车

**DELETE** `/api/cart/:id/items`

清空指定店铺的购物车。

**参数:**
- `id` (路径参数): 店铺ID (UUID)

**响应:**
HTTP 204 No Content

## 认证要求

所有 Cart API 端点都需要用户认证。请在请求头中包含有效的认证令牌：

```
Authorization: Bearer <your-token>
```

## 微服务调用

在其他服务中可以通过以下方式调用 cart service：

```typescript
// 获取购物车商品数量
const result = await ctx.call("cart.getCartItemQuantity", {
    shopId: "shop-uuid",
    itemId: "item-uuid"
}, {
    meta: { currentUserId: "user-uuid" }
});

// 更新购物车商品数量
const result = await ctx.call("cart.updateCartItemQuantity", {
    shopId: "shop-uuid",
    itemId: "item-uuid",
    quantity: 2
}, {
    meta: { currentUserId: "user-uuid" }
});

// 获取购物车信息
const cartInfo = await ctx.call("cart.getCartInfo", {
    id: "shop-uuid"
}, {
    meta: { currentUserId: "user-uuid" }
});

// 获取购物车商品列表
const cartItems = await ctx.call("cart.getCartItems", {
    id: "shop-uuid"
}, {
    meta: { currentUserId: "user-uuid" }
});

// 清空购物车
await ctx.call("cart.clearCart", {
    id: "shop-uuid"
}, {
    meta: { currentUserId: "user-uuid" }
});
```

## 注意事项

1. 所有需要用户身份的操作都通过 `ctx.meta.currentUserId` 获取当前用户ID
2. Cart service 会调用 `item.get` 服务来验证商品信息和获取商品详情
3. 购物车信息计算涉及商品价格和店铺配送信息，这些数据通过服务间调用获取
4. 参数验证使用 Joi Schema 进行，错误时返回标准的 ValidationError
