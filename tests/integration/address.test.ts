import request from 'supertest';
import { describeGenericAuthTest } from '../utils/auth-test.util';

describe('Address Service Integration Tests', () => {
    const baseURL = process.env.BASE_URL || 'http://localhost:3000';
    let userId: string;
    let authToken: string;
    const testUser = {
        email: `testuser_address_${Date.now()}@example.com`,
        password: 'Password123!',
    };

    // 测试数据
    const testAddress = {
        province: '广东',
        city: '深圳',
        district: '南山',
        address: '科技园',
        name: '张三',
        tel: '1234567890',
        coordinate: [113.93, 22.53],
        isDefault: true,
    };

    // 使用通用认证测试助手进行用户注册和登录
    beforeAll(() => {
        console.log('Testing against:', baseURL);
    });

    describe('Authentication Setup', () => {
        describeGenericAuthTest(request(baseURL), testUser.email, testUser.password, (token, id) => {
            authToken = token;
            userId = id;
        });
    });

    // 其他测试需要等待认证设置完成
    describe('Address Tests', () => {
        beforeAll(() => {
            if (!authToken || !userId) {
                throw new Error('Authentication not properly set up');
            }
        });

        describe('Address Management', () => {
            let addressId: string;

            it('should create a new address', async () => {
                const response = await request(baseURL)
                    .post('/api/addresses')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send(testAddress)
                    .expect('Content-Type', /json/)
                    .expect(200);

                expect(response.body).toHaveProperty('id');
                expect(response.body).toMatchObject({
                    province: testAddress.province,
                    city: testAddress.city,
                    district: testAddress.district,
                    address: testAddress.address,
                    name: testAddress.name,
                    tel: testAddress.tel,
                    coordinate: testAddress.coordinate,
                    isDefault: testAddress.isDefault,
                });

                addressId = response.body.id;
            });

            it('should get all addresses', async () => {
                const response = await request(baseURL)
                    .get('/api/addresses')
                    .set('Authorization', `Bearer ${authToken}`)
                    .expect('Content-Type', /json/)
                    .expect(200);

                expect(Array.isArray(response.body)).toBe(true);
                expect(response.body.length).toBeGreaterThanOrEqual(1);
                expect(response.body[0]).toMatchObject({
                    province: testAddress.province,
                    city: testAddress.city,
                    district: testAddress.district,
                    address: testAddress.address,
                    name: testAddress.name,
                    tel: testAddress.tel,
                    coordinate: testAddress.coordinate,
                    isDefault: testAddress.isDefault,
                });
            });

            it('should get a specific address', async () => {
                if (!addressId) throw new Error('Address ID not available');

                const response = await request(baseURL)
                    .get(`/api/addresses/${addressId}`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .expect('Content-Type', /json/)
                    .expect(200);

                expect(response.body).toMatchObject({
                    id: addressId,
                    province: testAddress.province,
                    city: testAddress.city,
                    district: testAddress.district,
                    address: testAddress.address,
                    name: testAddress.name,
                    tel: testAddress.tel,
                    coordinate: testAddress.coordinate,
                    isDefault: testAddress.isDefault,
                });
            });

            it('should update an address', async () => {
                if (!addressId) throw new Error('Address ID not available');

                const updatedAddress = {
                    province: '广西',
                    city: '南宁',
                };

                const response = await request(baseURL)
                    .patch(`/api/addresses/${addressId}`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .send(updatedAddress)
                    .expect('Content-Type', /json/)
                    .expect(200);

                expect(response.body).toMatchObject({
                    id: addressId,
                    province: updatedAddress.province,
                    city: updatedAddress.city,
                    district: testAddress.district,
                    address: testAddress.address,
                    name: testAddress.name,
                    tel: testAddress.tel,
                    coordinate: testAddress.coordinate,
                });
            });

            it('should delete an address', async () => {
                if (!addressId) throw new Error('Address ID not available');

                await request(baseURL)
                    .delete(`/api/addresses/${addressId}`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .expect(200);

                // 验证地址已被删除
                await request(baseURL)
                    .get(`/api/addresses/${addressId}`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .expect(404);

                const response = await request(baseURL)
                    .get(`/api/addresses`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .expect(200);

                expect(response.body).toEqual([]);
            });

            it('should fail to create more than maximum allowed addresses', async () => {
                // 创建最大数量的地址
                const promises = Array(16).fill(null).map((_, index) =>
                    request(baseURL)
                        .post('/api/addresses')
                        .set('Authorization', `Bearer ${authToken}`)
                        .send({
                            ...testAddress,
                            address: `测试地址${index + 1}`,
                        })
                );

                await Promise.all(promises);

                // 尝试创建第17个地址
                await request(baseURL)
                    .post('/api/addresses')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        ...testAddress,
                        address: '超出限制的地址',
                    })
                    .expect(403);

                // 清理测试数据
                const response = await request(baseURL)
                    .get('/api/addresses')
                    .set('Authorization', `Bearer ${authToken}`);

                for (const address of response.body) {
                    await request(baseURL)
                        .delete(`/api/addresses/${address.id}`)
                        .set('Authorization', `Bearer ${authToken}`)
                        .expect(200);
                }

                const cleanResponse = await request(baseURL)
                    .get('/api/addresses')
                    .set('Authorization', `Bearer ${authToken}`)
                    .expect(200);

                expect(cleanResponse.body).toEqual([]);
            });
        });

        describe('Address Order Management', () => {
            let firstAddressId: string;
            let secondAddressId: string;

            beforeAll(async () => {
                // 创建两个测试地址
                const response1 = await request(baseURL)
                    .post('/api/addresses')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        ...testAddress,
                        address: '测试地址1',
                    })
                    .expect(200);
                firstAddressId = response1.body.id;

                const response2 = await request(baseURL)
                    .post('/api/addresses')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        ...testAddress,
                        address: '测试地址2',
                        isDefault: false,
                    })
                    .expect(200);
                secondAddressId = response2.body.id;
            });

            it('should update address position', async () => {
                const response = await request(baseURL)
                    .patch(`/api/addresses/${secondAddressId}/pos`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({ before: firstAddressId })
                    .expect('Content-Type', /json/)
                    .expect(200);

                expect(Array.isArray(response.body)).toBe(true);

                // 验证顺序已更新
                const addresses = response.body;
                const firstAddressIndex = addresses.findIndex((a: any) => a.id === firstAddressId);
                const secondAddressIndex = addresses.findIndex((a: any) => a.id === secondAddressId);
                expect(secondAddressIndex).toBeLessThan(firstAddressIndex);
            });

            afterAll(async () => {
                await request(baseURL)
                    .delete(`/api/addresses/${firstAddressId}`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .expect(200);

                await request(baseURL)
                    .delete(`/api/addresses/${secondAddressId}`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .expect(200);
            });
        });

        describe('Default Address Behavior', () => {
            it('should automatically set first address as default', async () => {
                // 创建新地址
                const createResponse = await request(baseURL)
                    .post('/api/addresses')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send(testAddress)
                    .expect(200);

                expect(createResponse.body.isDefault).toBe(true);

                await request(baseURL)
                    .delete(`/api/addresses/${createResponse.body.id}`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .expect(200);
            });

            it('should handle default address changes when deleting', async () => {
                // 创建两个地址
                const response1 = await request(baseURL)
                    .post('/api/addresses')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        ...testAddress,
                        address: '默认地址',
                        isDefault: true,
                    });

                await request(baseURL)
                    .post('/api/addresses')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        ...testAddress,
                        address: '非默认地址',
                        isDefault: false,
                    });

                // 删除默认地址
                await request(baseURL)
                    .delete(`/api/addresses/${response1.body.id}`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .expect(200);

                // 检查剩余地址是否被设置为默认
                const finalResponse = await request(baseURL)
                    .get('/api/addresses')
                    .set('Authorization', `Bearer ${authToken}`);

                expect(finalResponse.body).toHaveLength(1);
                expect(finalResponse.body[0].isDefault).toBe(true);

                // 清理测试数据
                const response = await request(baseURL)
                    .get('/api/addresses')
                    .set('Authorization', `Bearer ${authToken}`);

                for (const address of response.body) {
                    await request(baseURL)
                        .delete(`/api/addresses/${address.id}`)
                        .set('Authorization', `Bearer ${authToken}`)
                        .expect(200);
                }

                const cleanResponse = await request(baseURL)
                    .get('/api/addresses')
                    .set('Authorization', `Bearer ${authToken}`)
                    .expect(200);

                expect(cleanResponse.body).toEqual([]);
            });
        });
    });
});
