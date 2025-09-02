import request from 'supertest';

describe('Hello Service Integration Tests', () => {
    const baseURL = process.env.BASE_URL || 'http://localhost:3000';
    
    beforeAll(() => {
        console.log('Testing against:', baseURL);
    });

    describe('GET /api/hello', () => {
        it('should return hello world message', async () => {
            const response = await request(baseURL)
                .get('/api/hello')
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toEqual({
                message: 'Hello World!'
            });
        });

        it('should return 200 status code', async () => {
            const response = await request(baseURL)
                .get('/api/hello');

            expect(response.status).toBe(200);
        });

        it('should have correct response structure', async () => {
            const response = await request(baseURL)
                .get('/api/hello')
                .expect(200);

            expect(response.body).toHaveProperty('message');
            expect(typeof response.body.message).toBe('string');
            expect(response.body.message).toBe('Hello World!');
        });
    });
});
