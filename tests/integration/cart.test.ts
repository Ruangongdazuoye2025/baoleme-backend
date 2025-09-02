// tests/integrated/cart.test.ts
import request from 'supertest';
import { describeGenericAuthTest } from '../utils/auth-test.util';

describe('Cart Service Integration Tests', () => {
    const baseURL = process.env.BASE_URL || 'http://localhost:3000';
    const testAgent = request(baseURL);

    let customerToken: string;
    let merchantToken: string;
    let merchantId: string;
    let shopId: string;
    let itemId: string;

    beforeAll(() => {
        console.log('Testing against:', baseURL);
    });

    const merchantUser = {
        email: `merchant_${Date.now()}@example.com`,
        password: 'Password123!',
    };

    const customerUser = {
        email: `customer_${Date.now()}@example.com`,
        password: 'Password123!',
    };

    // 1. 准备阶段：创建商家和顾客账号
    describe('Setup: Create Merchant and Customer', () => {
        describeGenericAuthTest(testAgent, merchantUser.email, merchantUser.password, (token, id) => {
            merchantToken = token;
            merchantId = id;
        });
        describeGenericAuthTest(testAgent, customerUser.email, customerUser.password, (token, id) => {
            customerToken = token;
        });
    });

    // 2. 准备阶段：创建店铺和商品
    describe('Setup: Create Shop and Item', () => {
        it('should update merchant role to MERCHANT', async () => {
            await testAgent
                .patch(`/api/user/${merchantId}/profile`)
                .set('Authorization', `Bearer ${merchantToken}`)
                .send({ role: 'merchant' })
                .expect(200);
        });

        it('should create a new shop with correct parameters', async () => {
            const response = await testAgent
                .post('/api/shops')
                .set('Authorization', `Bearer ${merchantToken}`)
                .send({
                    name: 'Test Cart Shop',
                    description: 'A shop for integration tests',
                    categories: [],
                    address: {
                        coordinate: [0, 0],
                        province: 'New York',
                        city: 'New York',
                        district: 'Manhattan',
                        address: '123 Test St',
                        name: 'Work',
                        tel: '1234567890'
                    },
                    opened: true,
                    openTimeStart: 0,
                    openTimeEnd: 1440,
                    deliveryThreshold: 20,
                    deliveryPrice: 5,
                    maximumDistance: 5000
                })
                .expect(200);
            
            expect(response.body).toHaveProperty('id');
            shopId = response.body.id;
        });

        it('should create a new item in the shop', async () => {
            const response = await testAgent
                .post(`/api/shops/${shopId}/items`)
                .set('Authorization', `Bearer ${merchantToken}`)
                .send({
                    name: 'Test Item',
                    description: 'A delicious test item',
                    price: 999, // in cents
                    priceWithoutPromotion: 1200,
                    categories: []
                })
                .expect(200);

            expect(response.body).toHaveProperty('id');
            itemId = response.body.id;
        });
    });

    // 3. 核心测试：购物车功能
    describe('Cart Operations', () => {
        it('should add an item to the cart', async () => {
            await testAgent
                .patch(`/api/cart/${shopId}/item/${itemId}`)
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ quantity: 1 })
                .expect(200);
        });

        it('should get the correct item quantity from the cart', async () => {
            const response = await testAgent
                .get(`/api/cart/${shopId}/item/${itemId}`)
                .set('Authorization', `Bearer ${customerToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('quantity', 1);
        });

        it('should get the list of items in the cart', async () => {
            const response = await testAgent
                .get(`/api/cart/${shopId}/items`)
                .set('Authorization', `Bearer ${customerToken}`)
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBe(1);
        });

        it('should update the item quantity in the cart', async () => {
            await testAgent
                .patch(`/api/cart/${shopId}/item/${itemId}`)
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ quantity: 5 })
                .expect(200);

            const response = await testAgent
                .get(`/api/cart/${shopId}/item/${itemId}`)
                .set('Authorization', `Bearer ${customerToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('quantity', 5);
        });

        it('should get cart information', async () => {
            const response = await testAgent
                .get(`/api/cart/${shopId}`)
                .set('Authorization', `Bearer ${customerToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('total');
            // 999分 * 5 = 4995分
            expect(response.body.total).toBe(4995);
        });

        it('should clear all items from the cart', async () => {
            await testAgent
                .delete(`/api/cart/${shopId}/items`)
                .set('Authorization', `Bearer ${customerToken}`)
                .expect(200); 
        });

        it('should have an empty item list after clearing', async () => {
            const response = await testAgent
                .get(`/api/cart/${shopId}/items`)
                .set('Authorization', `Bearer ${customerToken}`)
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBe(0);
        });
    });
});