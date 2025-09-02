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

    const testUser2 = {
        email: `testuser2_${Date.now()}@example.com`,
        password: 'Password123!',
    };

    const testShop = {
        name: '测试店铺',
        description: '这是一个测试店铺',
        categories: [],
        address: {
            coordinate: [116.397428, 39.90923],
            province: '北京',
            city: '北京',
            district: '东城区',
            address: '测试地址123号',
            name: '测试联系人',
            tel: '13800138000'
        },
        opened: true,
        openTimeStart: 480, 
        openTimeEnd: 1020, 
        deliveryThreshold: 2000, 
        deliveryPrice: 500, 
        maximumDistance: 5.0
    };

    let authToken: string;
    let userId: string;
    let shopId: string;
    let secondOwnerId: string;
    let secondauthToken: string;
    let categoryId: string;

    beforeAll(() => {
        console.log('Testing against:', baseURL);
    });


    describe('Generic Auth Test', () => {
        describeGenericAuthTest(request(baseURL), testUser.email, testUser.password, (token, id) => {
            authToken = token;
            userId = id;
        });
    })

    describe('Generic Auth Test', () => {
        describeGenericAuthTest(request(baseURL), testUser2.email, testUser2.password, (token, id) => {
            secondauthToken = token;
            secondOwnerId = id;
        });
    })

    describe('POST /api/shops', () => {
        it('should fail to create a shop without authentication', async () => {
            await request(baseURL)
                .post('/api/shops')
                .send(testShop)
                .expect(401);
        });

        it('should create a shop successfully', async () => {
            const response = await request(baseURL)
                .post('/api/shops')
                .set('Authorization', `Bearer ${authToken}`)
                .send(testShop)
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toHaveProperty('name', testShop.name);
            expect(response.body).toHaveProperty('description', testShop.description);
            expect(response.body).toHaveProperty('verified', false); // 新店铺默认未认证
            
            shopId = response.body.id;
        });
    });

    describe('POST /api/shops/{shopId}/item-categories', () => {
        it('should create a new item category', async () => {
            const categoryData = {
                name: '测试分类'
            };

            const response = await request(baseURL)
                .post(`/api/shops/${shopId}/item-categories`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(categoryData)
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toHaveProperty('id');
            expect(response.body).toHaveProperty('name', categoryData.name);
            
            categoryId = response.body.id;
        });
    });

    describe('GET /api/shops/{id}', () => {
        it('should get shop details successfully', async () => {
            const response = await request(baseURL)
                .get(`/api/shops/${shopId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toHaveProperty('id', shopId);
            expect(response.body).toHaveProperty('name', testShop.name);
            expect(response.body).toHaveProperty('description', testShop.description);
        });
    });

    describe('GET /api/user/{userId}/shops', () => {
        it('should get list of shops for a user successfully', async () => {
            const response = await request(baseURL)
                .get(`/api/user/${userId}/shops`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toBeInstanceOf(Array);
            expect(response.body.length).toBeGreaterThan(0);
            const shop = response.body.find((i: any) => i.id === shopId);
            expect(shop).toBeDefined();
            expect(shop.name).toBe(testShop.name);
        });
    });

    describe('GET /api/shops', () => {
        it('should get list of total shops ', async () => {
            const response = await request(baseURL)
                .get(`/api/shops`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toBeInstanceOf(Array);
            expect(response.body.length).toBeGreaterThan(0);
            const shop = response.body.find((i: any) => i.id === shopId);
            expect(shop).toBeDefined();
            expect(shop.name).toBe(testShop.name);
        });
    });

    describe('GET /api/shops/{shopId}/item-categories', () => {
        it('should get item categories list', async () => {
            const response = await request(baseURL)
                .get(`/api/shops/${shopId}/item-categories`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect('Content-Type', /json/)
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBeGreaterThan(0);
            expect(response.body[0]).toHaveProperty('id');
            expect(response.body[0]).toHaveProperty('name');
        });
    });

    describe('GET /api/shops/{shopId}/item-categories/{categoryId}', () => {
        it('should get single category info', async () => {
            const response = await request(baseURL)
                .get(`/api/shops/${shopId}/item-categories/${categoryId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toHaveProperty('id', categoryId);
            expect(response.body).toHaveProperty('name', '测试分类');
        });
    });

    describe('PATCH /api/shops/{shopId}/item-categories/{categoryId}/pos', () => {
        it('should update category position', async () => {
            const positionData = {
                before: null // 移动到最前面
            };

            await request(baseURL)
                .patch(`/api/shops/${shopId}/item-categories/${categoryId}/pos`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(positionData)
                .expect(200);
        });
    });

    describe('PATCH /api/shops/{shopId}/item-categories/{categoryId}', () => {
        it('should update category info', async () => {
            const updatedData = {
                name: '更新后的分类名称'
            };

            const response = await request(baseURL)
                .patch(`/api/shops/${shopId}/item-categories/${categoryId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(updatedData)
                .expect(200);

            expect(response.body).toHaveProperty('name', updatedData.name);
            expect(response.body).toHaveProperty('id', categoryId);
        });
    });

    describe('DELETE /api/shops/{shopId}/item-categories/{categoryId}}', () => {
        it('should delete category', async () => {
            await request(baseURL)
                .delete(`/api/shops/${shopId}/item-categories/${categoryId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);
        });
    });

    describe('PATCH /api/shops/{id}/owner', () => {
        it('should transfer shop ownership to another user', async () => {
            const owner = secondOwnerId;

            await request(baseURL)
                .patch(`/api/shops/${shopId}/owner`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ owner })
                .expect(200);

            const response = await request(baseURL)
                .get(`/api/shops/${shopId}`)
                .set('Authorization', `Bearer ${secondauthToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('owner', secondOwnerId);
        });
    });


    describe('DELETE /api/shops/{id}', () => {
        it('should fail to delete a shop without authentication', async () => {
            await request(baseURL)
                .delete(`/api/shops/${shopId}`)
                .expect(401);
        });

        it('should delete a shop successfully', async () => {
            await request(baseURL)
                .delete(`/api/shops/${shopId}`)
                .set('Authorization', `Bearer ${secondauthToken}`)
                .expect(200);
        });

        it('should return 404 when getting a deleted shop', async () => {
            await request(baseURL)
                .get(`/api/shops/${shopId}`)
                .set('Authorization', `Bearer ${secondauthToken}`)
                .expect(404);
        });
    });
});