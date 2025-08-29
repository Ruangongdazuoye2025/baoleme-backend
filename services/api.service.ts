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
                    "POST /auth/register": "auth.register",
                    "POST /auth/login": "auth.login",
                    "POST /auth/forgot-password": "auth.forgotPassword",
                    "POST /auth/verify-register": "auth.verifyRegister",
                    "POST /auth/verify-email": "auth.verifyEmail",
                    "POST /auth/reset-password": "auth.resetPassword",
                    "POST /auth/update-email": "auth.updateEmail",
                    "POST /auth/update-password": "auth.updatePassword",

                    "GET /user/:id": "user.get",
                    "PATCH /user/:id/profile": "user.updateProfile",
                    "PATCH /user/:id/avatar": "multipart:user.uploadAvatar",
                    "DELETE /user/:id/avatar": "user.deleteAvatar",

                    "GET /cart/:shopId/item/:itemId": "cart.getCartItemQuantity",
                    "PATCH /cart/:shopId/item/:itemId": "cart.updateCartItemQuantity",
                    "GET /cart/:id": "cart.getCartInfo",
                    "GET /cart/:id/items": "cart.getCartItems",
                    "DELETE /cart/:id/items": "cart.clearCart",

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

                    "POST /addresses": "address.addAddress",
                    "GET  /addresses": "address.getAddresses",
                    "GET  /addresses/:id": "address.getAddressById",
                    "PATCH  /addresses/:id": "address.updateAddress",
                    "PATCH /addresses/:id/pos": "address.updateAddressOrder",
                    "DELETE /addresses/:id": "address.deleteAddress",
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
