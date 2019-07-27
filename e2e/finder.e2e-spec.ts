import { HttpStatus, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import 'jest';
import * as querystring from 'querystring';
import * as supertest from 'supertest';
import { AdminModule, AsunaCollections, KvService } from '../src/modules';
import { keyByType } from '../src/modules/core/finder';

describe('FinderModule (e2e)', () => {
  let app: INestApplication;
  let kvService: KvService;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [TypeOrmModule.forRoot(), AdminModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    kvService = app.get(KvService);
    await kvService.set({
      collection: AsunaCollections.SYSTEM_SERVER,
      key: keyByType.assets,
      type: 'json',
      value: { default: { hostname: 'hostname' } },
    });

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/GET /api/v1/finder', async () => {
    await kvService.set({
      collection: AsunaCollections.SYSTEM_SERVER,
      key: keyByType.assets,
      type: 'json',
      value: { default: { endpoint: 'https://hostname' } },
    });

    const query = querystring.stringify({
      query: querystring.stringify({ path: '1/2/3.png' }),
      type: 'assets',
    });
    expect(query).toBe('query=path%3D1%252F2%252F3.png&type=assets');
    return supertest(app.getHttpServer())
      .get(`/api/v1/finder?${query}`)
      .expect(HttpStatus.FOUND)
      .expect(expected => {
        expect(expected.text).toBe('Found. Redirecting to https://hostname/1/2/3.png');
        expect(expected.header.location).toBe('https://hostname/1/2/3.png');
      });
  });

  it('/GET /f', async () => {
    await kvService.set({
      collection: AsunaCollections.SYSTEM_SERVER,
      key: keyByType.assets,
      type: 'json',
      value: { default: { endpoint: 'https://hostname' } },
    });

    const encodedQuery = Buffer.from(querystring.stringify({ path: '1/2/3.png' })).toString(
      'base64',
    );
    const query = Buffer.from(`${encodedQuery}.0.assets`).toString('base64');
    expect(query).toBe('Y0dGMGFEMHhKVEpHTWlVeVJqTXVjRzVuLjAuYXNzZXRz');
    return supertest(app.getHttpServer())
      .get(`/f/${query}`)
      .expect(HttpStatus.FOUND)
      .expect(expected => {
        expect(expected.text).toBe('Found. Redirecting to https://hostname/1/2/3.png');
        expect(expected.header.location).toBe('https://hostname/1/2/3.png');
      });
  });

  it('/GET /api/v1/finder with same domain', async () => {
    await kvService.set({
      collection: AsunaCollections.SYSTEM_SERVER,
      key: keyByType.assets,
      type: 'json',
      value: { default: { endpoint: '/s3' } },
    });

    const query = querystring.stringify({
      query: querystring.stringify({ path: '1/2/3.png' }),
      type: 'assets',
    });
    expect(query).toBe('query=path%3D1%252F2%252F3.png&type=assets');
    return supertest(app.getHttpServer())
      .get(`/api/v1/finder?${query}`)
      .expect(HttpStatus.FOUND)
      .expect(expected => {
        expect(expected.text).toBe('Found. Redirecting to /s3/1/2/3.png');
        expect(expected.header.location).toBe('/s3/1/2/3.png');
      });
  });
});
