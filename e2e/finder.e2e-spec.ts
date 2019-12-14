import { HttpStatus, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as querystring from 'querystring';
import * as supertest from 'supertest';
import { AdminInternalModule, AsunaCollections, CacheManager, FinderHelper, KvHelper } from '../src/modules';

describe('FinderModule (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [TypeOrmModule.forRoot(), AdminInternalModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/GET /api/v1/finder', async () => {
    await KvHelper.set({
      collection: AsunaCollections.SYSTEM_SERVER,
      key: 'settings.finder.assets',
      type: 'json',
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
      .expect(expected => {
        expect(expected.text).toBe('Found. Redirecting to https://hostname/1/2/3.png');
        expect(expected.header.location).toBe('https://hostname/1/2/3.png');
      });
  });

  it('/GET /f', async () => {
    await KvHelper.set({
      collection: AsunaCollections.SYSTEM_SERVER,
      key: 'settings.finder.assets',
      type: 'json',
      value: { values: { endpoint: 'https://hostname' } },
    });

    const encodedQuery = Buffer.from(querystring.stringify({ path: '1/2/3.png' })).toString('base64');
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
    await CacheManager.clear({ kvDef: FinderHelper.kvDef, fieldKey: 'endpoint' });
    await KvHelper.set({
      collection: AsunaCollections.SYSTEM_SERVER,
      key: 'settings.finder.assets',
      type: 'json',
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
      .expect(expected => {
        expect(expected.text).toBe('Found. Redirecting to /s3/1/2/3.png');
        expect(expected.header.location).toBe('/s3/1/2/3.png');
      });
  });
});
