// tests/integrated/item.test.ts
import request from 'supertest';
import { SmtpTestServer } from '../utils/smtp.util';
import { describeGenericAuthTest } from '../utils/auth-test.util';

describe('Item Service Integration Tests', () => {
    const baseURL = process.env.BASE_URL || 'http://localhost:3000';
    const testUser = {
        email: `merchant_${Date.now()}@example.com`,
        password: 'Password123!',
    };

    let authToken: string;
    let userId: string;
    let shopId: string;
    let categoryId: string;
    let itemId: string;

    // 在所有测试开始前，注册一个商家用户并创建店铺
    beforeAll(() => {
        console.log('Testing against:', baseURL);
    }); // 增加 beforeAll 的超时时间

    describe('Setup: Create Merchant, Shop, and Category', () => {
        describeGenericAuthTest(request(baseURL), testUser.email, testUser.password, (token, id) => {
            authToken = token;
            userId = id;
        });

        it('should update user role to MERCHANT', async () => {
            await request(baseURL)
                .patch(`/api/user/${userId}/profile`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ role: 'merchant' })
                .expect(200);
        });

        it('should create a new shop for the merchant', async () => {
            const shopResponse = await request(baseURL)
                .post('/api/shops')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'My Test Shop',
                    description: 'A shop for testing purposes',
                    categories: [], // 假设可以为空或需要预先获取
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
                    deliveryThreshold: 0,
                    deliveryPrice: 0,
                    maximumDistance: 0
                })
                .expect(200);
            shopId = shopResponse.body.id;
        });

        it('should create an item category for the shop', async () => {
            const categoryResponse = await request(baseURL)
                .post(`/api/shops/${shopId}/item-categories`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ name: 'Test Category' })
                .expect(200);
            categoryId = categoryResponse.body.id;
        });
    });

    describe('POST /api/shops/{shopId}/items', () => {
        it('should fail to add an item without authentication', async () => {
            await request(baseURL)
                .post(`/api/shops/${shopId}/items`)
                .send({
                    name: 'Test Item',
                    description: 'A delicious test item',
                    price: 1000,
                    categories: [categoryId]
                })
                .expect(401);
        });

        it('should add an item to the shop successfully', async () => {
            const response = await request(baseURL)
                .post(`/api/shops/${shopId}/items`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'Test Item',
                    description: 'A delicious test item',
                    price: 1000, // in cents
                    priceWithoutPromotion: 1200,
                    categories: [categoryId]
                })
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toHaveProperty('id');
            expect(response.body).toHaveProperty('name', 'Test Item');
            itemId = response.body.id;
        });
    });

    describe('GET /api/items/{id}', () => {
        it('should get item details successfully', async () => {
            const response = await request(baseURL)
                .get(`/api/items/${itemId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toHaveProperty('id', itemId);
            expect(response.body).toHaveProperty('name', 'Test Item');
            expect(response.body).toHaveProperty('shopId', shopId);
        });
    });

    describe('GET /api/shops/{shopId}/items', () => {
        it('should get list of items for a shop', async () => {
            const response = await request(baseURL)
                .get(`/api/shops/${shopId}/items`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toBeInstanceOf(Array);
            expect(response.body.length).toBeGreaterThan(0);
            const item = response.body.find((i: any) => i.id === itemId);
            expect(item).toBeDefined();
            expect(item.name).toBe('Test Item');
        });
    });

    describe('PATCH /api/items/{id}/profile', () => {
        it('should update item details successfully', async () => {
            const updatedName = 'Updated Test Item';
            const response = await request(baseURL)
                .patch(`/api/items/${itemId}/profile`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ name: updatedName, price: 1100 })
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toHaveProperty('id', itemId);
            expect(response.body).toHaveProperty('name', updatedName);
            expect(response.body).toHaveProperty('price', 1100);
        });

        it('should fail to update item without authentication', async () => {
            await request(baseURL)
                .patch(`/api/items/${itemId}/profile`)
                .send({ name: 'Another Update' })
                .expect(401);
        });
    });

    describe('DELETE /api/items/{id}', () => {
        it('should fail to delete an item without authentication', async () => {
            await request(baseURL)
                .delete(`/api/items/${itemId}`)
                .expect(401);
        });

        it('should delete an item successfully', async () => {
            await request(baseURL)
                .delete(`/api/items/${itemId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);
        });

        it('should return 404 when getting a deleted item', async () => {
            await request(baseURL)
                .get(`/api/items/${itemId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(404);
        });
    });
});