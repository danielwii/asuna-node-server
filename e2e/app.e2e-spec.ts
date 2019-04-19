import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as supertest from 'supertest';
import 'jest';

import { AdminModule } from '../src/modules';
import { AuthModule } from '../src/modules/core/auth/auth.module';
import { JwtStrategy } from '../src/modules/core/auth/strategy/jwt.strategy';
import { TypeOrmModule } from '@nestjs/typeorm';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [TypeOrmModule.forRoot(), AdminModule],
    })
      .overrideProvider(AuthModule)
      .useValue({})
      .overrideProvider(JwtStrategy)
      .useValue({})
      .compile();

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
        console.log(expected.text);
        expect(JSON.parse(expected.text)).not.toBeNull();
      });
  });
});
