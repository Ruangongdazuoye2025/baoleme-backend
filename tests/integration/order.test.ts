import request from 'supertest';
import { describeGenericAuthTest } from '../utils/auth-test.util';

type TestAgent = request.SuperTest<request.Test>;

describe('Order Service Integration Tests', () => {
    const baseURL = process.env.BASE_URL || 'http://localhost:3000';
    const req = request(baseURL);

    // Users
    const customer = { email: `customer_order_${Date.now()}@example.com`, password: 'Password123!' };
    let customerToken: string;
    let customerId: string;

    const merchant = { email: `merchant_order_${Date.now()}@example.com`, password: 'Password123!' };
    let merchantToken: string;
    let merchantId: string;

    const rider = { email: `rider_order_${Date.now()}@example.com`, password: 'Password123!' };
    let riderToken: string;
    let riderId: string;

    // Test data
    let shopId: string;
    let itemId: string;
    let addressId: string;
    let orderId: string;

    const testItem = {
        name: '测试订单商品',
        description: '这是一个用于订单测试的商品',
        price: 1500, // 15元
        priceWithoutPromotion: 2000,
        available: true,
        stockout: false,
        categories: []
    };

    const shopData = {
        name: '测试订单店铺',
        description: '用于订单测试的店铺',
        categories: [],
        address: {
            coordinate: [116.3, 39.9], province: '北京', city: '北京', district: '海淀区',
            address: '中关村', name: '店长', tel: '10086'
        },
        opened: true, openTimeStart: 0, openTimeEnd: 1440,
        deliveryThreshold: 1000, deliveryPrice: 500, maximumDistance: 10
    };

    beforeAll(() => {
        console.log('Testing against:', baseURL);
    });

    // Setup: Create users, shop, item, address, and cart
    describe('Setup for Order Tests', () => {
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
            // verify shop
            await req.patch(`/api/shops/${shopId}/profile`).set('Authorization', `Bearer ${merchantToken}`).send({ verified: true }).expect(200);
        });

        it('should create an item in the shop', async () => {
            const res = await req.post(`/api/shops/${shopId}/items`).set('Authorization', `Bearer ${merchantToken}`).send(testItem).expect(200);
            itemId = res.body.id;
        });

        it('should create a delivery address for customer', async () => {
            const addressData = {
                coordinate: [116.3, 39.91], province: '北京', city: '北京', district: '海淀区',
                address: '五道口', name: '顾客', tel: '10010', isDefault: true
            };
            const res = await req.post('/api/addresses').set('Authorization', `Bearer ${customerToken}`).send(addressData).expect(200);
            addressId = res.body.id;
        });

        it('should add item to cart', async () => {
            await req.patch(`/api/cart/${shopId}/item/${itemId}`).set('Authorization', `Bearer ${customerToken}`).send({ quantity: 1 }).expect(200);
        });
    });

    describe('Order Creation and Lifecycle', () => {
        it('should create an order from cart', async () => {
            const res = await req.post('/api/orders')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ shopId, addressId, note: '请快点送达' })
                .expect(200);

            expect(res.body.id).toBeDefined();
            expect(res.body.status).toBe('unpaid');
            expect(res.body.shop).toBe(shopId);
            expect(res.body.customer).toBe(customerId);
            expect(res.body.total).toBe(testItem.price + shopData.deliveryPrice);
            orderId = res.body.id;
        });

        it('should get the order as customer', async () => {
            const res = await req.get(`/api/orders/${orderId}`).set('Authorization', `Bearer ${customerToken}`).expect(200);
            expect(res.body.id).toBe(orderId);
        });

        it('should appear in customer order list', async () => {
            const res = await req.get('/api/orders/as-customer').set('Authorization', `Bearer ${customerToken}`).expect(200);
            expect(res.body.some((o: any) => o.id === orderId)).toBe(true);
        });

        it('should simulate payment and update status to preparing', async () => {
            // This is a mock step, in real world it would be a callback from a payment gateway
            // For testing, we directly update the status as if payment was successful.
            // Assuming customer can trigger this change for now.
            const res = await req.patch(`/api/orders/${orderId}/status`)
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ status: 'preparing' })
                .expect(200);
            expect(res.body.status).toBe('preparing');
        });

        it('should appear in shop order list', async () => {
            const res = await req.get(`/api/orders/as-shop/${shopId}`).set('Authorization', `Bearer ${merchantToken}`).expect(200);
            expect(res.body.some((o: any) => o.id === orderId)).toBe(true);
        });

        it('should be updated to prepared by merchant', async () => {
            const res = await req.patch(`/api/orders/${orderId}/status`)
                .set('Authorization', `Bearer ${merchantToken}`)
                .send({ status: 'prepared' })
                .expect(200);
            expect(res.body.status).toBe('prepared');
        });

        it('should be accepted by a rider', async () => {
            const res = await req.patch(`/api/orders/${orderId}/rider`)
                .set('Authorization', `Bearer ${riderToken}`)
                .expect(200);
            expect(res.body.status).toBe('delivering');
            expect(res.body.rider).toBe(riderId);
        });
        
        it('should appear in rider order list', async () => {
            const res = await req.get('/api/orders/as-rider').set('Authorization', `Bearer ${riderToken}`).expect(200);
            expect(res.body.some((o: any) => o.id === orderId)).toBe(true);
        });

        it('should allow rider to update delivery location', async () => {
            await req.patch(`/api/orders/${orderId}/delivery`)
                .set('Authorization', `Bearer ${riderToken}`)
                .send({ longitude: 116.305, latitude: 39.905 })
                .expect(200);
        });

        it('should be updated to finished by rider', async () => {
            const res = await req.patch(`/api/orders/${orderId}/status`)
                .set('Authorization', `Bearer ${riderToken}`)
                .send({ status: 'finished' })
                .expect(200);
            expect(res.body.status).toBe('finished');
        });
    });

    describe('Order Cancellation', () => {
        let cancellableOrderId: string;

        beforeAll(async () => {
            // Create a new order to test cancellation
            await req.patch(`/api/cart/${shopId}/item/${itemId}`).set('Authorization', `Bearer ${customerToken}`).send({ quantity: 1 }).expect(200);
            const res = await req.post('/api/orders').set('Authorization', `Bearer ${customerToken}`).send({ shopId, addressId, note: 'to be cancelled' }).expect(200);
            cancellableOrderId = res.body.id;
        });

        it('should allow customer to cancel an unpaid order', async () => {
            const res = await req.patch(`/api/orders/${cancellableOrderId}/status`)
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ status: 'canceled' })
                .expect(200);
            expect(res.body.status).toBe('canceled');
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
