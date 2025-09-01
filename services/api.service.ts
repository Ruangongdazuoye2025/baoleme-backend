import { Context, ServiceSchema } from "moleculer";
import ApiGateway, { IncomingRequest, Route, GatewayResponse, ApiSettingsSchema } from 'moleculer-web'
import ApiAuthMixin from "../mixins/api-auth.mixin";

const E = ApiGateway.Errors;



const ApiService: ServiceSchema<ApiSettingsSchema> = {
    name: "api",
    mixins: [ApiGateway, ApiAuthMixin],
    settings: {
        port: parseInt(process.env.PORT || "3000"),
        ip: "0.0.0.0",
        routes: [
            {
                path: "/api",
                mappingPolicy: "restrict",
                authorization: true,
                aliases: {
                    // Auth
                    "POST /auth/register": "auth.register",
                    "POST /auth/login": "auth.login",
                    "POST /auth/forgot-password": "auth.forgotPassword",
                    "POST /auth/verify-register": "auth.verifyRegister",
                    "POST /auth/verify-email": "auth.verifyEmail",
                    "POST /auth/reset-password": "auth.resetPassword",
                    "POST /auth/update-email": "auth.updateEmail",
                    "POST /auth/update-password": "auth.updatePassword",

                    // User
                    "GET /user/:id": "user.get",
                    "PATCH /user/:id/profile": "user.updateProfile",
                    "PATCH /user/:id/avatar": "multipart:user.uploadAvatar",
                    "DELETE /user/:id/avatar": "user.deleteAvatar",

                    // Cart
                    "GET /cart/:shopId/item/:itemId": "cart.getCartItemQuantity",
                    "PATCH /cart/:shopId/item/:itemId": "cart.updateCartItemQuantity",
                    "GET /cart/:id": "cart.getCartInfo",
                    "GET /cart/:id/items": "cart.getCartItems",
                    "DELETE /cart/:id/items": "cart.clearCart",

                    // Favorite & History
                    "GET /records/shops": "history.getShopHistory",
                    "POST /records/shops/:id": "history.createShopHistory",
                    "GET /records/items": "history.getItemHistory",
                    "POST /records/items/:id": "history.createItemHistory",
                    "GET /favorites/shops": "history.getShopFavourite",
                    "POST /favorites/shops/:id": "history.createShopFavourite",
                    "GET /favorites/items": "history.getItemFavourite",
                    "POST /favorites/items/:id": "history.createItemFavourite",
                    "GET /favorites/shops/:id": "history.getShopFavouriteById",
                    "GET /favorites/items/:id": "history.getItemFavouriteById",
                    "DELETE /records/shops/:id": "history.deleteShopHistory",
                    "DELETE /records/items/:id": "history.deleteItemHistory",
                    "DELETE /favorites/shops/:id": "history.deleteShopFavourite",
                    "DELETE /favorites/items/:id": "history.deleteItemFavourite",

                    // Address
                    "POST /addresses": "address.addAddress",
                    "GET  /addresses": "address.getAddresses",
                    "GET  /addresses/:id": "address.getAddressById",
                    "PATCH  /addresses/:id": "address.updateAddress",
                    "PATCH /addresses/:id/pos": "address.updateAddressOrder",
                    "DELETE /addresses/:id": "address.deleteAddress",

                    // Order
                    "GET /orders/as-customer": "order.getOrdersAsCustomer",
                    "GET /orders/as-shop/:id": "order.getOrdersAsShop",
                    "GET /orders/as-rider": "order.getOrdersAsRider",
                    "GET /orders": "order.getOrders",
                    "GET /orders/:id": "order.getOrderById",
                    "POST /orders": "order.createOrder",
                    "PATCH /orders/:id/rider": "order.updateOrderRider",
                    "PATCH /orders/:id/status": "order.updateOrderStatus",
                    "PATCH /orders/:id/delivery": "order.updateOrderDelivery",
                    "DELETE /orders/:id": "order.deleteOrder",

                    // Shop
                    "GET /shops": "shop.getFilteredGlobalShops",
                    "GET /user/:id/shops": "shop.getShopsByOwnerId",
                    "POST /shops": "shop.createShop",
                    "GET /shops/:id": "shop.get",
                    "DELETE /shops/:id": "shop.deleteShop",
                    "PATCH /shops/:id/profile": "shop.updateShopProfile",
                    "PATCH /shops/:id/image": "multipart:shop.updateShopImage",
                    "PATCH /shops/:id/owner": "multipart:shop.updateShopOwner",
                    "POST /shops/:shopId/item-categories": "shop.addItemCategory",
                    "GET /shops/:shopId/item-categories": "shop.getItemCategories",
                    "GET /shops/:shopId/item-categories/:categoryId":"shop.getItemCategory",
                    "PATCH /shops/:shopId/item-categories/:categoryId":"shop.updateItemCategory",
                    "PATCH /shops/:shopId/item-categories/:categoryId/pos":"shop.updateItemCategoryPos",
                    "DELETE /shops/:shopId/item-categories/:categoryId":"shop.deleteItemCategory",

                    // Recommended
                    "GET /recommended/shops": "recommended.getRecommendedShops",
                    "GET /recommended/items": "recommended.getRecommendedItems",
                    "GET /recommended/orders": "recommended.getRecommendedOrders",

                    // Item
                    "GET /shops/:shopId/items": "item.getItems",
                    "GET /shops/:shopId/item-categories/:categoryId/items": "item.getShopCategoryItems",
                    "GET /items/:id": "item.get",
                    "POST /shops/:shopId/items": "item.createItem",
                    "PATCH /items/:id/profile": "item.updateItemProfile",
                    "PATCH /items/:id/cover": "multipart:item.updateItemImage",
                    "DELETE /items/:id": "item.deleteItem",

                    // Review
                    "POST /comments": "review.create",
                    "GET /comments/by-order/:id": "review.getByOrderId",
                    "GET /shop/:id/comments": "review.getByShopId",
                    "PATCH /comments/:id": "review.update",
                    "DELETE /comments/:id": "review.delete",
                    
                },
                onAfterCall(ctx, route, req, res, data) {
                    if (!data) {
                        res.statusCode = 204
                    }
                    return data
                },
            }
        ]
    },
};

export default ApiService;