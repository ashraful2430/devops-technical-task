const request = require('supertest');
const app = require('../app/server');

describe('API endpoints', () => {
  it('GET /status should return 200', async () => {
    const res = await request(app).get('/status');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe('ok');
  });

  it('POST /data should return 201 with valid payload', async () => {
    const res = await request(app)
      .post('/data')
      .send({ name: 'test', value: 123 });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('POST /data should return 400 with invalid payload', async () => {
    const res = await request(app)
      .post('/data')
      .send({ name: 'only-name' });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });
});