import { ExpressAdapter } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';

import querystring from 'query-string';
import supertest from 'supertest';

import { AppLifecycle } from '../src/lifecycle';
import { AdminAuthService, AdminInternalModule, LoggerHelper, TokenHelper } from '../src/modules';
import { TaskEvent, TaskRecord } from '../src/modules/task';

import type { INestApplication } from '@nestjs/common';

describe('AppRestController (e2e)', () => {
  let app: INestApplication;
  let token;

  beforeAll(async () => {
    await AppLifecycle.preload();
    const moduleFixture = await Test.createTestingModule({
      imports: [TypeOrmModule.forRoot(), AdminInternalModule],
    }).compile();

    app = moduleFixture.createNestApplication(new ExpressAdapter() as any, { logger: LoggerHelper.getLoggerService() });

    await app.init();

    const task = await TaskRecord.save(TaskRecord.create({ uniqueId: 'u1' }));
    const task2 = await TaskRecord.save(TaskRecord.create({ uniqueId: 'u2' }));
    await TaskEvent.save(TaskEvent.create({ task, message: 'e11' }));
    await TaskEvent.save(TaskEvent.create({ task, message: 'e12' }));
    await TaskEvent.save(TaskEvent.create({ task: task2, message: 'e21' }));

    const authService = app.get<AdminAuthService>(AdminAuthService);
    token = (await TokenHelper.createToken(await authService.getUser({ email: 'admin@example.com' }))).accessToken;
  });

  afterAll(() => {
    app.close();
  });

  it('/GET /api/info', () => {
    return supertest(app.getHttpServer())
      .get('/api/info')
      .expect(200)
      .expect((expected) => {
        expect(JSON.parse(expected.text)).not.toBeNull();
      });
  });

  it('load tasks', () => {
    return supertest(app.getHttpServer())
      .get('/admin/rest/sys/tasks')
      .set('Authorization', `Mgmt ${token}`)
      .expect(200)
      .expect((expected) => {
        expect(JSON.parse(expected.text).total).toBe(2);
      });
  });

  it('query with condition', () => {
    return supertest(app.getHttpServer())
      .get(`/admin/rest/sys/tasks?fields=id,uniqueId&where=${JSON.stringify({ uniqueId: 'u1' })}`)
      .set('Authorization', `Mgmt ${token}`)
      .expect(200)
      .expect((expected) => {
        const response = JSON.parse(expected.text);
        expect(response.total).toBe(1);
        expect(response.items[0].uniqueId).toBe('u1');
        expect(response.items[0].id).toContain('st');
      });
  });

  it('query with relation', () => {
    return supertest(app.getHttpServer())
      .get(
        `/admin/rest/sys/tasks?fields=id,uniqueId&relations=events&where=${JSON.stringify({
          'events.message': 'e11',
        })}`,
      )
      .set('Authorization', `Mgmt ${token}`)
      .expect(200)
      .expect((expected) => {
        const response = JSON.parse(expected.text);
        expect(response.total).toBe(1);
        expect(response.items[0].uniqueId).toEqual('u1');
        expect(response.items[0].events[0].message).toEqual('e11');
      });
  });

  it('fuzzy query 1', async () => {
    const params = querystring.stringify({
      where: JSON.stringify({ uniqueId: { $like: '%u%' } }),
    });
    return supertest(app.getHttpServer())
      .get(`/admin/rest/sys/tasks?${params}`)
      .set('Authorization', `Mgmt ${token}`)
      .expect(200)
      .expect((expected) => {
        const response = JSON.parse(expected.text);
        expect(response.total).toBe(2);
        expect(response.items[0].uniqueId).toBe('u1');
        expect(response.items[0].id).toContain('st');
      });
  });

  it('fuzzy query 2', async () => {
    const params = querystring.stringify({
      where: JSON.stringify([{ uniqueId: { $like: '%u%' } }, { uniqueId: { $like: '%1%' } }]),
    });
    return supertest(app.getHttpServer())
      .get(`/admin/rest/sys/tasks?${params}`)
      .set('Authorization', `Mgmt ${token}`)
      .expect(200)
      .expect((expected) => {
        const response = JSON.parse(expected.text);
        expect(response.total).toBe(2);
        expect(response.items[0].uniqueId).toBe('u1');
        expect(response.items[0].id).toContain('st');
      });
  });

  it('query with operator', async () => {
    const params = querystring.stringify({
      where: JSON.stringify({
        service: { $isNull: true },
      }),
    });
    return supertest(app.getHttpServer())
      .get(`/admin/rest/sys/tasks?${params}`)
      .set('Authorization', `Mgmt ${token}`)
      .expect(200)
      .expect((expected) => {
        const response = JSON.parse(expected.text);
        expect(response.total).toBe(2);
      });
  });
});
