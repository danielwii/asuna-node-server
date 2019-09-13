import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as supertest from 'supertest';
import { Connection, getManager } from 'typeorm';
import { AdminInternalModule, AppInfo, resolveTypeormPaths } from '../src';

describe('Excel (e2e)', () => {
  let app: INestApplication;
  beforeAll(async () => {
    resolveTypeormPaths();
    const module = await Test.createTestingModule({
      imports: [TypeOrmModule.forRoot(), AdminInternalModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    const connection = app.get(Connection);
    connection.close();
    await app.close();
  });

  it('/POST /api/v1/import-export', async () => {
    await supertest(app.getHttpServer())
      .post('/api/v1/import-export?name=app__infos')
      .set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .attach('file', `${__dirname}/Book1.xlsx`)
      .expect(201)
      .then(async response => {
        const resCount = await getManager().findAndCount(AppInfo);
        expect(resCount.length).not.toBeLessThan(1);
        return true;
      });
  });

  it('/GET /api/v1/import-export/export', async () => {
    await supertest(app.getHttpServer())
      .get('/api/v1/import-export/export')
      .send([
        { username: 'hahahha', password: 'lalala' },
        { username: 'lililil', password: 'puppupu' },
      ])
      .set('Content-Type', 'application/json')
      .expect(200)
      .then(response => {
        const file = response.files;
        expect(file).not.toBeNull();
        return true;
      });
  });

  it('/GET /api/v1/import-export/model', async () => {
    await supertest(app.getHttpServer())
      .get('/api/v1/import-export/model?name=app__infos')
      .set('Content-Type', 'application/json')
      .expect(200)
      .then(response => {
        const file = response.files;
        expect(file).not.toBeNull();
        return true;
      });
  });
});
