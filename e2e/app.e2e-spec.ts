import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as supertest from 'supertest';
import { AdminModule } from '../src/modules';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [TypeOrmModule.forRoot(), AdminModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/GET /api/info', () => {
    return supertest(app.getHttpServer())
      .get('/api/info')
      .expect(200)
      .expect(expected => {
        expect(JSON.parse(expected.text)).not.toBeNull();
      });
  });
});
