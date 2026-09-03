import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

/**
 * Boots the real application module, so this requires the Docker Postgres to be
 * up (`docker compose up -d`). PrismaService now fails fast on a bad connection
 * rather than warning, so a failure here means the database is unreachable.
 */
describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  it('GET /api/v1/health responds without authentication', () => {
    return request(app.getHttpServer()).get('/api/v1/health').expect(200);
  });

  it('GET /api/v1/complaints is denied without a token', () => {
    // Deny-by-default: the global JwtAuthGuard must reject unauthenticated
    // access to anything not marked @Public().
    return request(app.getHttpServer()).get('/api/v1/complaints').expect(401);
  });

  afterEach(async () => {
    await app.close();
  });
});
