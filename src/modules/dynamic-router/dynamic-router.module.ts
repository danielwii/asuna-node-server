import { MiddlewareConsumer, NestModule, OnModuleInit } from '@nestjs/common';
import { LoggerFactory } from '../common/logger';
import { DynamicRouterMiddleware } from './dynamic-router.middleware';

const logger = LoggerFactory.getLogger('DynamicRouterModule');

export class DynamicTextRouter {
  path: string;
  text: string;
}

export type DynamicTextRouters = DynamicTextRouter[];

export class DynamicRouterModule implements NestModule, OnModuleInit {
  configure(consumer: MiddlewareConsumer): any {
    consumer.apply(DynamicRouterMiddleware).forRoutes('*');
  }

  async onModuleInit(): Promise<void> {
    logger.log('init...');

    await this.initKV();
  }

  async initKV(): Promise<void> {
    // 1.reg dynamic-text-router
  }
}
