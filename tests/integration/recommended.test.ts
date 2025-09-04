import request from 'supertest';
import { describeGenericAuthTest } from '../utils/auth-test.util';

type TestAgent = request.SuperTest<request.Test>;

describe('Recommendation Service Integration Tests', () => {
    const baseURL = process.env.BASE_URL || 'http://localhost:3000';
    const req = request(baseURL);

    // Users
    const customer = { email: `customer_rec_${Date.now()}@example.com`, password: 'Password123!' };
    let customerToken: string;
    let customerId: string;

    const merchant = { email: `merchant_rec_${Date.now()}@example.com`, password: 'Password123!' };
    let merchantToken: string;
    let merchantId: string;

    const rider = { email: `rider_rec_${Date.now()}@example.com`, password: 'Password123!' };
    let riderToken: string;
    let riderId: string;

    // Test data
    let shopId: string;
    let itemId: string;
    let addressId: string;
    let orderId: string;

    const testItem = {
        name: '测试推荐商品',
        description: '这是一个用于推荐测试的商品',
        price: 1200,
        priceWithoutPromotion: 1500,
        available: true,
        stockout: false,
        categories: []
    };

    const shopData = {
        name: '测试推荐店铺',
        description: '用于推荐测试的店铺',
        categories: [],
        address: {
            coordinate: [116.4, 39.9], province: '北京', city: '北京', district: '朝阳区',
            address: '三里屯', name: '店长', tel: '10086'
        },
        opened: true, openTimeStart: 0, openTimeEnd: 1440,
        deliveryThreshold: 1000, deliveryPrice: 500, maximumDistance: 10
    };

    beforeAll(() => {
        console.log('Testing against:', baseURL);
    });

    // Setup: Create users, shop, item, address, and an order
    describe('Setup for Recommendation Tests', () => {
        // Create customer
        describeGenericAuthTest(req, customer.email, customer.password, (token, id) => {
            customerToken = token;
            customerId = id;
        });

        // Create merchant
        describeGenericAuthTest(req, merchant.email, merchant.password, (token, id) => {
            merchantToken = token;
            merchantId = id;
        });

        // Create rider
        describeGenericAuthTest(req, rider.email, rider.password, (token, id) => {
            riderToken = token;
            riderId = id;
        });

        it('should update user roles', async () => {
            await req.patch(`/api/user/${merchantId}/profile`).set('Authorization', `Bearer ${merchantToken}`).send({ role: 'merchant' }).expect(200);
            await req.patch(`/api/user/${riderId}/profile`).set('Authorization', `Bearer ${riderToken}`).send({ role: 'rider' }).expect(200);
        });

        it('should create a shop', async () => {
            const res = await req.post('/api/shops').set('Authorization', `Bearer ${merchantToken}`).send(shopData).expect(200);
            shopId = res.body.id;
        });

        it('should verify the created shop', async () => {
            await req.patch(`/api/shops/${shopId}/profile`).set('Authorization', `Bearer ${merchantToken}`).send({ verified: true }).expect(200);
        });

        it('should create an item in the shop', async () => {
            const res = await req.post(`/api/shops/${shopId}/items`).set('Authorization', `Bearer ${merchantToken}`).send(testItem).expect(200);
            itemId = res.body.id;
        });

        it('should create a delivery address for customer', async () => {
            const addressData = {
                coordinate: [116.41, 39.91], province: '北京', city: '北京', district: '东城区',
                address: '王府井', name: '顾客', tel: '10010', isDefault: true
            };
            const res = await req.post('/api/addresses').set('Authorization', `Bearer ${customerToken}`).send(addressData).expect(200);
            addressId = res.body.id;
        });

        it('should add item to cart and create an order', async () => {
            await req.patch(`/api/cart/${shopId}/item/${itemId}`).set('Authorization', `Bearer ${customerToken}`).send({ quantity: 1 }).expect(200);
            const res = await req.post('/api/orders').set('Authorization', `Bearer ${customerToken}`).send({ shopId, addressId, note: 'order for recommendation test' }).expect(200);
            orderId = res.body.id;
        });

        it('should process the order to "prepared" state', async () => {
            // Simulate payment
            await req.patch(`/api/orders/${orderId}/status`).set('Authorization', `Bearer ${customerToken}`).send({ status: 'preparing' }).expect(200);
            // Merchant marks as prepared
            await req.patch(`/api/orders/${orderId}/status`).set('Authorization', `Bearer ${merchantToken}`).send({ status: 'prepared' }).expect(200);
        });
    });

    describe('Recommendation Endpoints', () => {
        it('GET /api/recommended/shops - should get recommended shops for customer', async () => {
            const res = await req.get('/api/recommended/shops')
                .set('Authorization', `Bearer ${customerToken}`)
                .query({ a: addressId })
                .expect(200);

            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body.some((s: any) => s.id === shopId)).toBe(true);
            const shop = res.body.find((s: any) => s.id === shopId);
            expect(shop).toHaveProperty('distance');
            expect(shop).toHaveProperty('time');
        });

        it('GET /api/recommended/items - should get recommended items for customer', async () => {
            const res = await req.get('/api/recommended/items')
                .set('Authorization', `Bearer ${customerToken}`)
                .query({ a: addressId })
                .expect(200);

            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body.some((i: any) => i.id === itemId)).toBe(true);
        });

        it('GET /api/recommended/orders - should get recommended orders for rider', async () => {
            const res = await req.get('/api/recommended/orders')
                .set('Authorization', `Bearer ${riderToken}`)
                .query({ lat: 39.9, lon: 116.4 }) // Rider's location near the shop
                .expect(200);

            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body.some((o: any) => o.id === orderId)).toBe(true);
            const order = res.body.find((o: any) => o.id === orderId);
            expect(order.status).toBe('prepared');
        });
    });

    afterAll(async () => {
        if (itemId) {
            await req.delete(`/api/items/${itemId}`).set('Authorization', `Bearer ${merchantToken}`);
        }
        if (shopId) {
            await req.delete(`/api/shops/${shopId}`).set('Authorization', `Bearer ${merchantToken}`);
        }
    });
});
