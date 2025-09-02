// tests/integrated/auth.test.ts
import request from 'supertest';
import dotenv from 'dotenv';
import { SmtpTestServer } from '../utils/smtp.util';

// 加载环境变量
dotenv.config();

// 为测试配置 SMTP 服务器
const SMTP_PORT = 1025;
const SMTP_HOST = '127.0.0.1';

describe('Auth and User Service Integration Tests', () => {
    const baseURL = process.env.BASE_URL || 'http://localhost:3000';
    const smtpServer = new SmtpTestServer(SMTP_PORT, SMTP_HOST);

    let userId: string;
    let authToken: string;
    const testUser = {
        email: `testuser_${Date.now()}@example.com`,
        password: 'Password123!',
    };

    beforeAll(async () => {
        await smtpServer.start(SMTP_PORT, SMTP_HOST);
        console.log('Testing against:', baseURL);
    }, 30000); // 增加 beforeAll 的超时时间

    afterAll(async () => {
        await smtpServer.stop();
    }, 30000);

    describe('User Registration and Verification', () => {
        it('should register a new user and send a verification email', async () => {
            await request(baseURL)
                .post('/api/auth/register')
                .send({ email: testUser.email, password: testUser.password })
                .expect(200); // 根据 auth.service.ts, 成功时返回 200
        });

        it('should fail to register with an existing email', async () => {
            await request(baseURL)
                .post('/api/auth/register')
                .send({ email: testUser.email, password: testUser.password })
                .expect(403); // 根据 auth.service.ts, 邮箱已存在时返回 403
        });

        it('should verify the user account using the token from email', async () => {
            const mail = await smtpServer.waitForMail()
            expect(mail.to).not.toBeUndefined();
            expect(Array.isArray(mail.to)).toBe(false);
            expect((mail.to as any).text).toContain(testUser.email);
            expect(mail.subject).toBe('Email Verification');
            const tokenMatch = mail.html?.toString().match(/token=([^"]+)/);
            expect(tokenMatch).not.toBeNull();
            const token = decodeURIComponent(tokenMatch![1]);
            smtpServer.resetMailPromise();
            await request(baseURL)
                .post('/api/auth/verify-register')
                .send({ token })
                .expect(200);
        }, 20000); // 增加等待邮件的超时时间
    });

    describe('User Login', () => {
        it('should fail to login with wrong password', async () => {
            await request(baseURL)
                .post('/api/auth/login')
                .send({ email: testUser.email, password: 'wrongpassword' })
                .expect(403); // 根据 auth.service.ts, 登录失败时返回 403
        });

        it('should login successfully with correct credentials', async () => {
            const response = await request(baseURL)
                .post('/api/auth/login')
                .send({ email: testUser.email, password: testUser.password })
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toHaveProperty('token');
            expect(response.body).toHaveProperty('id');
            expect(typeof response.body.token).toBe('string');
            
            authToken = response.body.token;
            userId = response.body.id;
        });
    });

    describe('Get User Information', () => {
        it('should fail to get user info without an authentication token', async () => {
            if (!userId) throw new Error('User ID not available.');
            await request(baseURL)
                .get(`/api/user/${userId}`)
                .expect(401);
        });

        it('should get user info successfully with a valid token', async () => {
            if (!userId || !authToken) throw new Error('User ID or Auth Token not available.');
            
            const response = await request(baseURL)
                .get(`/api/user/${userId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toHaveProperty('id', userId);
            expect(response.body).toHaveProperty('email', testUser.email);
            expect(response.body).not.toHaveProperty('password');
        });
    });
});