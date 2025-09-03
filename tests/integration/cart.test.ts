import request from 'supertest';
import { describeGenericAuthTest } from '../utils/auth-test.util';

describe('Cart Service Integration Tests', () => {
    const baseURL = process.env.BASE_URL || 'http://localhost:3000';
    let userId: string;
    let authToken: string;
    let shopId: string;
    let itemId: string;

    const testUser = {
        email: `testuser_cart_${Date.now()}@example.com`,
        password: 'Password123!',
    };

    const testMerchant = {
        email: `merchant_cart_${Date.now()}@example.com`,
        password: 'Password123!',
    };

    let merchantToken: string;
    let merchantId: string;

    // 测试商品数据
    const testItem = {
        name: '测试商品',
        description: '这是一个测试商品',
        price: 1000, // 10元
        priceWithoutPromotion: 1200,
        available: true,
        stockout: false,
        categories: []
    };

    beforeAll(() => {
        console.log('Testing against:', baseURL);
    });

    describe('Setup: Create Merchant, Shop, and Item', () => {
        // 创建商家账号
        describeGenericAuthTest(request(baseURL), testMerchant.email, testMerchant.password, (token, id) => {
            merchantToken = token;
            merchantId = id;
        });

        it('should update merchant role', async () => {
            await request(baseURL)
                .patch(`/api/user/${merchantId}/profile`)
                .set('Authorization', `Bearer ${merchantToken}`)
                .send({ role: 'merchant' })
                .expect(200);
        });

        it('should create a shop', async () => {
            const shopData = {
                name: '测试店铺',
                description: '用于购物车测试的店铺',
                categories: [],
                address: {
                    coordinate: [113.93, 22.53],
                    province: '广东',
                    city: '深圳',
                    district: '南山',
                    address: '科技园',
                    name: '张三',
                    tel: '1234567890'
                },
                opened: true,
                openTimeStart: 480,  // 8:00
                openTimeEnd: 1320,   // 22:00
                deliveryThreshold: 2000, // 20元起送
                deliveryPrice: 500,  // 5元配送费
                maximumDistance: 5    // 5公里配送范围
            };

            const response = await request(baseURL)
                .post('/api/shops')
                .set('Authorization', `Bearer ${merchantToken}`)
                .send(shopData)
                .expect(200);

            shopId = response.body.id;
        });

        it('should create a test item', async () => {
            const response = await request(baseURL)
                .post(`/api/shops/${shopId}/items`)
                .set('Authorization', `Bearer ${merchantToken}`)
                .send(testItem)
                .expect(200);

            itemId = response.body.id;
        });

        // 创建顾客账号
        describeGenericAuthTest(request(baseURL), testUser.email, testUser.password, (token, id) => {
            authToken = token;
            userId = id;
        });
    });

    describe('Cart Tests', () => {
        beforeAll(() => {
            if (!authToken || !userId || !itemId || !shopId) {
                throw new Error('Test setup not properly completed');
            }
        });

        describe('Cart Item Management', () => {
            it('should initially return 404 for non-existent cart item', async () => {
                await request(baseURL)
                    .get(`/api/cart/${shopId}/item/${itemId}`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .expect(404);
            });

            it('should add item to cart', async () => {
                const quantity = 2;
                const response = await request(baseURL)
                    .patch(`/api/cart/${shopId}/item/${itemId}`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({ quantity })
                    .expect(200);

                console.log(response.body);

                expect(response.body).toMatchObject({
                    quantity: quantity,
                    cart: expect.objectContaining({
                        total: testItem.price * quantity,
                        totalWithoutPromotion: testItem.priceWithoutPromotion * quantity
                    })
                });
            });

            it('should get cart item quantity', async () => {
                const response = await request(baseURL)
                    .get(`/api/cart/${shopId}/item/${itemId}`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .expect(200);

                expect(response.body).toHaveProperty('quantity', 2);
            });

            it('should update item quantity', async () => {
                const newQuantity = 3;
                const response = await request(baseURL)
                    .patch(`/api/cart/${shopId}/item/${itemId}`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({ quantity: newQuantity })
                    .expect(200);

                expect(response.body).toMatchObject({
                    quantity: newQuantity,
                    cart: expect.objectContaining({
                        total: testItem.price * newQuantity,
                        totalWithoutPromotion: testItem.priceWithoutPromotion * newQuantity
                    })
                });
            });

            it('should remove item when quantity is set to 0', async () => {
                await request(baseURL)
                    .patch(`/api/cart/${shopId}/item/${itemId}`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({ quantity: 0 })
                    .expect(200);

                await request(baseURL)
                    .get(`/api/cart/${shopId}/item/${itemId}`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .expect(404);
            });
        });

        describe('Cart Information', () => {
            beforeAll(async () => {
                // 添加商品到购物车
                await request(baseURL)
                    .patch(`/api/cart/${shopId}/item/${itemId}`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({ quantity: 2 });
            });

            it('should get cart information', async () => {
                const response = await request(baseURL)
                    .get(`/api/cart/${shopId}`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .expect(200);

                expect(response.body).toMatchObject({
                    total: testItem.price * 2,
                    totalWithoutPromotion: testItem.priceWithoutPromotion * 2,
                    settlable: true  // 因为总价超过起送价
                });
            });

            it('should get cart items list', async () => {
                const response = await request(baseURL)
                    .get(`/api/cart/${shopId}/items`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .expect(200);

                expect(Array.isArray(response.body)).toBe(true);
                expect(response.body.length).toBe(1);
                expect(response.body[0]).toMatchObject({
                    quantity: 2,
                    item: expect.objectContaining({
                        id: itemId,
                        name: testItem.name,
                        price: testItem.price
                    })
                });
            });

            it('should clear cart', async () => {
                await request(baseURL)
                    .delete(`/api/cart/${shopId}/items`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .expect(200);

                // 验证购物车已清空
                const response = await request(baseURL)
                    .get(`/api/cart/${shopId}/items`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .expect(200);

                expect(response.body).toEqual([]);
            });
        });

        describe('Cart Error Cases', () => {
            it('should fail to add item from non-existent shop', async () => {
                const fakeShopId = '00000000-0000-0000-0000-000000000000';
                await request(baseURL)
                    .patch(`/api/cart/${fakeShopId}/item/${itemId}`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({ quantity: 1 })
                    .expect(404);
            });

            it('should fail to add non-existent item', async () => {
                const fakeItemId = '00000000-0000-0000-0000-000000000000';
                await request(baseURL)
                    .patch(`/api/cart/${shopId}/item/${fakeItemId}`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({ quantity: 1 })
                    .expect(404);
            });
        });
    });

    // 清理测试数据
    afterAll(async () => {
        if (itemId) {
            await request(baseURL)
                .delete(`/api/items/${itemId}`)
                .set('Authorization', `Bearer ${merchantToken}`);
        }
        if (shopId) {
            await request(baseURL)
                .delete(`/api/shops/${shopId}`)
                .set('Authorization', `Bearer ${merchantToken}`);
        }
    });
});
