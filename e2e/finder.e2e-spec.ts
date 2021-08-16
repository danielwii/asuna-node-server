import { HttpStatus, INestApplication } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';

import querystring from 'query-string';
import supertest from 'supertest';

import { AppLifecycle } from '../src/lifecycle';
import {
  AdminInternalModule,
  AsunaCollections,
  CacheManager,
  KeyValueType,
  KvHelper,
  LoggerHelper,
} from '../src/modules';

describe('FinderModule (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await AppLifecycle.preload();
    const moduleFixture = await Test.createTestingModule({
      imports: [TypeOrmModule.forRoot(), AdminInternalModule],
    }).compile();

    app = moduleFixture.createNestApplication(new ExpressAdapter() as any, { logger: LoggerHelper.getLoggerService() });

    await app.init();
  });

  afterAll(() => {
    app.close();
  });

  it('/GET /api/v1/finder', async () => {
    await KvHelper.set({
      collection: AsunaCollections.SYSTEM_SERVER,
      key: 'settings.finder.assets',
      type: KeyValueType.json,
      value: { values: { endpoint: 'https://hostname' } },
    });

    const query = querystring.stringify({
      query: querystring.stringify({ path: '1/2/3.png' }),
      type: 'assets',
    });
    expect(query).toBe('query=path%3D1%252F2%252F3.png&type=assets');
    return supertest(app.getHttpServer())
      .get(`/api/v1/finder?${query}`)
      .expect(HttpStatus.FOUND)
      .expect((expected) => {
        expect(expected.text).toBe('Found. Redirecting to https://hostname/1/2/3.png');
        expect(expected.header.location).toBe('https://hostname/1/2/3.png');
      });
  });

  it('/GET /f', async () => {
    await KvHelper.set({
      collection: AsunaCollections.SYSTEM_SERVER,
      key: 'settings.finder.assets',
      type: KeyValueType.json,
      value: { values: { endpoint: 'https://hostname' } },
    });

    const encodedQuery = Buffer.from(querystring.stringify({ path: '1/2/3.png' })).toString('base64');
    const query = Buffer.from(`${encodedQuery}.0.assets`).toString('base64');
    expect(query).toBe('Y0dGMGFEMHhKVEpHTWlVeVJqTXVjRzVuLjAuYXNzZXRz');
    return supertest(app.getHttpServer())
      .get(`/f/${query}`)
      .expect(HttpStatus.FOUND)
      .expect((expected) => {
        expect(expected.text).toBe('Found. Redirecting to https://hostname/1/2/3.png');
        expect(expected.header.location).toBe('https://hostname/1/2/3.png');
      });
  });

  it('/GET /api/v1/finder with same domain', async () => {
    CacheManager.clearAll();
    await KvHelper.set({
      collection: AsunaCollections.SYSTEM_SERVER,
      key: 'settings.finder.assets',
      type: KeyValueType.json,
      // merge: true,
      value: { values: { endpoint: '/s3' } },
    });

    const query = querystring.stringify({
      query: querystring.stringify({ path: '1/2/3.png' }),
      type: 'assets',
    });
    expect(query).toBe('query=path%3D1%252F2%252F3.png&type=assets');
    return supertest(app.getHttpServer())
      .get(`/api/v1/finder?${query}`)
      .expect(HttpStatus.FOUND)
      .expect((expected) => {
        expect(expected.text).toBe('Found. Redirecting to /s3/1/2/3.png');
        expect(expected.header.location).toBe('/s3/1/2/3.png');
      });
  });
});
