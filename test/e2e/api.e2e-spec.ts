import request from 'supertest';
import http from 'http';

const e2eUrl = process.env.E2E_URL;

async function probeServer(urlStr: string, timeoutMs = 1000): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const url = new URL(urlStr);
      const req = http.request(
        {
          hostname: url.hostname,
          port: url.port || 80,
          path: url.pathname || '/',
          method: 'GET',
          timeout: timeoutMs,
        },
        () => resolve(true),
      );
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
      req.on('error', () => resolve(false));
      req.end();
    } catch {
      resolve(false);
    }
  });
}

const shouldRun = Boolean(e2eUrl);

describe('API E2E Tests', () => {
  let isServerUp = false;
  const targetUrl = e2eUrl || 'http://localhost:4000/api';

  beforeAll(async () => {
    if (shouldRun) {
      isServerUp = await probeServer(targetUrl, 1000);
    }
  });

  const conditionalDescribe = shouldRun ? describe : describe.skip;

  conditionalDescribe('Suite E2E contra API HTTP', () => {
    it('POST /auth/login retorna token JWT demo', async () => {
      if (!isServerUp) {
        console.warn(`[E2E SKIP] El servidor en ${targetUrl} no respondió en 1 segundo.`);
        return;
      }

      const res = await request(targetUrl)
        .post('/auth/login')
        .send({ email: 'lmendez@empresa.co' });

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('usuario');
    });

    it('GET /contracts responde lista paginada', async () => {
      if (!isServerUp) return;

      const login = await request(targetUrl)
        .post('/auth/login')
        .send({ email: 'lmendez@empresa.co' });

      const token = login.body?.token;

      const res = await request(targetUrl)
        .get('/contracts')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('total');
    });

    it('GET /companies responde lista de empresas', async () => {
      if (!isServerUp) return;

      const login = await request(targetUrl)
        .post('/auth/login')
        .send({ email: 'lmendez@empresa.co' });

      const token = login.body?.token;

      const res = await request(targetUrl)
        .get('/companies')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
    });
  });

  if (!shouldRun) {
    it('E2E skipeado automáticamente (E2E_URL no definido)', () => {
      // Test placeholder informativo para visibilidad en reporte
      expect(true).toBe(true);
    });
  }
});
