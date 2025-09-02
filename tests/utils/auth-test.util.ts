import TestAgent from "supertest/lib/agent";
import { SmtpTestServer } from "./smtp.util";

export const describeGenericAuthTest = (testAgent: TestAgent, email: string, password: string, callback: (token: string, id: string) => void) => {
    it('should register a new user and send a verification email', async () => {
        await testAgent
            .post('/api/auth/register')
            .send({ email, password })
            .expect(200);
    });

    it('should verify the user account using the token from email', async () => {
        const mail = await ((global as any).smtpServer as SmtpTestServer).waitForMail();
        expect(mail.to).not.toBeUndefined();
        expect(Array.isArray(mail.to)).toBe(false);
        expect((mail.to as any).text).toContain(email);
        expect(mail.subject).toBe('Email Verification');
        const tokenMatch = mail.html?.toString().match(/token=([^"]+)/);
        expect(tokenMatch).not.toBeNull();
        const token = decodeURIComponent(tokenMatch![1]);
        ((global as any).smtpServer as SmtpTestServer).resetMailPromise();
        await testAgent
            .post('/api/auth/verify-register')
            .send({ token })
            .expect(200);
    }, 20000); // 增加等待邮件的超时时间

    it('should login successfully with correct credentials', async () => {
        const response = await testAgent
            .post('/api/auth/login')
            .send({ email, password })
            .expect('Content-Type', /json/)
            .expect(200);

        expect(response.body).toHaveProperty('token');
        expect(response.body).toHaveProperty('id');
        expect(typeof response.body.token).toBe('string');

        callback(response.body.token, response.body.id);
    });
}