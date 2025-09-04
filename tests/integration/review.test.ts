import request from 'supertest';
import { SmtpTestServer } from '../utils/smtp.util';
import { describeGenericAuthTest } from '../utils/auth-test.util';


describe('Review Service Integration Tests', () => {
    const baseURL = process.env.BASE_URL || 'http://localhost:3000';

    const testUser = {
        email: `merchant_${Date.now()}@example.com`,
        password: 'Password123!',
    };


    const testUser2 = {
        email: `customer_${Date.now()}@example.com`,
        password: 'Password123!',
    };

    const testUser3 = {
        email: `rider_${Date.now()}@example.com`,
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
        openTimeStart: 0, 
        openTimeEnd: 1440, 
        deliveryThreshold: 2000, 
        deliveryPrice: 500, 
        maximumDistance: 5.0
    };

    let merchantAuthToken: string;
    let merchantUserId: string;
    let customerAuthToken: string;
    let customerUserId: string;
    let riderAuthToken: string;
    let riderUserId: string;
    let shopId: string;
    let orderId: string;
    let commentId: string;
    let addressId: string;
    let itemId: string;

    beforeAll(() => {
        console.log('Testing against:', baseURL);
    });

    describe('Generic Auth Test', () => {
        describeGenericAuthTest(request(baseURL), testUser.email, testUser.password, (token, id) => {
            merchantAuthToken = token;
            merchantUserId = id;
        });
    })

    describe('Generic Auth Test', () => {
        describeGenericAuthTest(request(baseURL), testUser2.email, testUser2.password, (token, id) => {
            customerAuthToken = token;
            customerUserId = id;
        });
    })

    describe('Generic Auth Test', () => {
        describeGenericAuthTest(request(baseURL), testUser3.email, testUser3.password, (token, id) => {
            riderAuthToken = token;
            riderUserId = id;
    })
    });
    describe('beforeEach', () => {
        it('should create a shop successfully', async () => {
            const response = await request(baseURL)
                .post('/api/shops')
                .set('Authorization', `Bearer ${merchantAuthToken}`)
                .send(testShop)
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toHaveProperty('name', testShop.name);
            expect(response.body).toHaveProperty('description', testShop.description);
            expect(response.body).toHaveProperty('verified', false); // 新店铺默认未认证

            shopId = response.body.id;
        });

        it('should update shop veried status', async () => {
            const updatedData = {
                name: '更新后店铺名称',
                description: '更新后描述',
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
                verified: true,
                opened: true,
                openTimeStart: 0, 
                openTimeEnd: 1440, 
                deliveryThreshold: 2000, 
                deliveryPrice: 500, 
                maximumDistance: 5.0
            };
            const response = await request(baseURL)
                .patch(`/api/shops/${shopId}/profile`)
                .set('Authorization', `Bearer ${merchantAuthToken}`)
                .send(updatedData)
                .expect('Content-Type', /json/)
                .expect(200);
        });

        it('should add an item to the shop successfully', async () => {
            const response = await request(baseURL)
                .post(`/api/shops/${shopId}/items`)
                .set('Authorization', `Bearer ${merchantAuthToken}`)
                .send({
                    name: 'Test Item',
                    description: 'A delicious test item',
                    price: 1000, // in cents
                    priceWithoutPromotion: 1200,
                    categories: []
                })
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toHaveProperty('id');
            expect(response.body).toHaveProperty('name', 'Test Item');
            itemId = response.body.id;
        });

        it('should add item to cart', async () => {
            const quantity = 2;
            const response = await request(baseURL)
                .patch(`/api/cart/${shopId}/item/${itemId}`)
                .set('Authorization', `Bearer ${customerAuthToken}`)
                .send({ quantity })
                .expect(200);
        });

        it('should create a delivery address', async () => {
            const addressData = {
                coordinate: [116.403875, 39.915168],
                province: '北京',
                city: '北京',
                district: '东城区',
                address: '王府井大街88号',
                name: '收货人',
                tel: '13800138000',
                isDefault: true
            };

            const response = await request(baseURL)
                .post('/api/addresses')
                .set('Authorization', `Bearer ${customerAuthToken}`)
                .send(addressData)
                .expect(200);

            expect(response.body).toHaveProperty('id');
            addressId = response.body.id;
        });

        it('should create a test order', async () => {
            
            const orderData = {
                shopId: shopId,
                addressId: addressId,
                note: '测试订单备注'
            };

            const response = await request(baseURL)
                .post('/api/orders')
                .set('Authorization', `Bearer ${customerAuthToken}`)
                .send(orderData);

            expect(response.status).toBe(200);

            orderId = response.body.id;
        });

        it('should update user role to rider', async () => {
            const newRiderData = {
                role: 'rider',
                emailVisible: true,
                createdAtVisible: true
            };
            const response = await request(baseURL)
                .patch(`/api/user/${riderUserId}/profile`)
                .set('Authorization', `Bearer ${riderAuthToken}`)
                .send(newRiderData)
                .expect('Content-Type', /json/)
                .expect(200);
        });

        it('should update order status', async () => {
            
            const FINISHED_STATUS = 'finished'
            const PREPARED_STATUS = 'prepared'
            const DELIVERING_STATUS = 'delivering'
            const newlocation = {
                latitude: 116.403875,
                longitude: 39.915168,
            }
            const preparingResponse = await request(baseURL)
                .patch(`/api/orders/${orderId}/status`)
                .set('Authorization', `Bearer ${customerAuthToken}`)
                .send({status: 'preparing'})
                .expect(200);

            const preparedResponse = await request(baseURL)
                .patch(`/api/orders/${orderId}/status`)
                .set('Authorization', `Bearer ${merchantAuthToken}`)
                .send({status: PREPARED_STATUS})
                .expect(200);

            const riderResponse = await request(baseURL)
                .patch(`/api/orders/${orderId}/rider`)
                .set('Authorization', `Bearer ${riderAuthToken}`)
                .expect(200);

            const deliveryResponse = await request(baseURL)
                .patch(`/api/orders/${orderId}/delivery`)
                .set('Authorization', `Bearer ${riderAuthToken}`)
                .send(newlocation);


            const finishedResponse = await request(baseURL)
                .patch(`/api/orders/${orderId}/status`)
                .set('Authorization', `Bearer ${riderAuthToken}`)
                .send({status: FINISHED_STATUS})
                .expect(200);
        });
    });




    // 评论接口测试
    describe('POST /api/comments', () => {
        it('should fail to create comment without authentication', async () => {
            const commentData = {
                order: orderId,
                rating: 45,
                content: '非常好的服务！'
            };

            await request(baseURL)
                .post('/api/comments')
                .send(commentData)
                .expect(401);
        });

        it('should create comment successfully', async () => {
            const commentData = {
                order: orderId,
                rating: 45,
                content: '非常好的服务！配送很快，食物美味。'
            };

            const response = await request(baseURL)
                .post('/api/comments')
                .set('Authorization', `Bearer ${customerAuthToken}`)
                .send(commentData)
                .expect(200);

            expect(response.body).toHaveProperty('id');
            expect(response.body).toHaveProperty('order', orderId);
            expect(response.body).toHaveProperty('rating', 45);
            expect(response.body).toHaveProperty('content', commentData.content);
            expect(response.body.user).toHaveProperty('id', customerUserId);

            commentId = response.body.id;
        });

        it('should fail to create duplicate comment for same order', async () => {
            const commentData = {
                order: orderId,
                rating: 40,
                content: '第二次评价'
            };

            await request(baseURL)
                .post('/api/comments')
                .set('Authorization', `Bearer ${customerAuthToken}`)
                .send(commentData)
                .expect(409); // 冲突错误
        });
    });

    describe('GET /api/shop/{id}/comments', () => {
        it('should fail to get comments without authentication', async () => {
            await request(baseURL)
                .get(`/api/shop/${shopId}/comments?p=0&pn=10`)
                .expect(401);
        });

        it('should get shop comments with pagination', async () => {
            const response = await request(baseURL)
                .get(`/api/shop/${shopId}/comments?p=0&pn=10`)
                .set('Authorization', `Bearer ${merchantAuthToken}`)
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBeGreaterThan(0);
            
            const comment = response.body.find((c: any) => c.id === commentId);
            expect(comment).toBeDefined();
            expect(comment).toHaveProperty('rating', 45);
            expect(comment).toHaveProperty('content');
            expect(comment.user).toHaveProperty('id', customerUserId);
        });

    });

    describe('GET /comments/by-order/{id}', () => {
        it('should fail to get order comment without authentication', async () => {
            await request(baseURL)
                .get(`/api/comments/by-order/${orderId}`)
                .expect(401);
        });

        it('should get comment by order id', async () => {
            const response = await request(baseURL)
                .get(`/api/comments/by-order/${orderId}`)
                .set('Authorization', `Bearer ${merchantAuthToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('id', commentId);
            expect(response.body).toHaveProperty('order', orderId);
            expect(response.body).toHaveProperty('rating', 45);
        });

        it('should return 404 for non-existent order comment', async () => {
            const nonExistentOrderId = '00000000-0000-0000-0000-000000000000';
            await request(baseURL)
                .get(`/comments/by-order/${nonExistentOrderId}`)
                .set('Authorization', `Bearer ${merchantUserId}`)
                .expect(404);
        });
    });

    describe('PATCH /api/comments/{id}', () => {
        it('should fail to update comment without authentication', async () => {
            const updateData = {
                rating: 40,
                content: '更新后的评价内容'
            };

            await request(baseURL)
                .patch(`/api/comments/${commentId}`)
                .send(updateData)
                .expect(401);
        });

        it('should fail to update other user\'s comment', async () => {
            const updateData = {
                rating: 40,
                content: '尝试修改他人的评价'
            };

            await request(baseURL)
                .patch(`/api/comments/${commentId}`)
                .set('Authorization', `Bearer ${merchantAuthToken}`)
                .send(updateData)
                .expect(403); // 禁止访问
        });

        it('should update comment successfully', async () => {
            const updateData = {
                rating: 40,
                content: '更新后的评价内容，服务依然很好！'
            };

            const response = await request(baseURL)
                .patch(`/api/comments/${commentId}`)
                .set('Authorization', `Bearer ${customerAuthToken}`)
                .send(updateData)
                .expect(200);

            expect(response.body).toHaveProperty('rating', 40);
            expect(response.body).toHaveProperty('content', updateData.content);
        });
    });

    describe('DELETE /api/comments/{id}', () => {
        it('should fail to delete comment without authentication', async () => {
            await request(baseURL)
                .delete(`/api/comments/${commentId}`)
                .expect(401);
        });

        it('should fail to delete other user\'s comment', async () => {
            await request(baseURL)
                .delete(`/api/comments/${commentId}`)
                .set('Authorization', `Bearer ${merchantAuthToken}`)
                .expect(403);
        });

        it('should delete comment successfully', async () => {
            await request(baseURL)
                .delete(`/api/comments/${commentId}`)
                .set('Authorization', `Bearer ${customerAuthToken}`)
                .expect(200);
        });

        it('should return 404 when getting deleted comment', async () => {
            await request(baseURL)
                .get(`/api/comments/by-order/${orderId}`)
                .set('Authorization', `Bearer ${customerAuthToken}`)
                .expect(404);
        });

        it('should return 404 when deleting non-existent comment', async () => {
            const nonExistentCommentId = '00000000-0000-0000-0000-000000000000';
            await request(baseURL)
                .delete(`/comments/${nonExistentCommentId}`)
                .set('Authorization', `Bearer ${customerAuthToken}`)
                .expect(404);
        });
    });
});