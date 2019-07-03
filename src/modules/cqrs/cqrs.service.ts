import { Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';
import * as _ from 'lodash';
import { Hermes, IAsunaEvent } from '../core/bus';

import { AbstractAuthUser } from '../core/auth';

export interface IAsunaCommand {
  type: string;
  service: string;
  payload: any;
  user: AbstractAuthUser;
  extra?: object;
  tracking?: object;
}

export class AsunaCommand implements IAsunaCommand {
  type: string;
  service: string;
  payload: any = null;
  user: AbstractAuthUser;
  extra?: object;
  tracking?: object;

  constructor(opts: {
    type?: string;
    service: string;
    payload: any;
    user: AbstractAuthUser;
    req?: Request;
  }) {
    this.service = opts.service;
    this.payload = opts.payload;
    this.user = opts.user;
    this.type = opts.type || 'default/v1';
    this.extra = { ua: opts.req != null ? opts.req.headers['user-agent'] : null };
  }
}

const logger = new Logger('CqrsService');

@Injectable()
export class CqrsService {
  private static resolvers: {
    [tag: string]: (command: IAsunaCommand) => Promise<IAsunaEvent[]> | IAsunaEvent[];
  } = {};

  async handleCommand(command: IAsunaCommand): Promise<IAsunaEvent[]> {
    logger.log(`handle command: ${JSON.stringify(command)}`);
    const events = _.compact(await this.resolveCommandToEvents(command));
    logger.log(`events: ${JSON.stringify(events)}`);
    Hermes.emitEvents('cqrs', events);
    return events;
  }

  reg(
    tag: string,
    resolver: (command: IAsunaCommand) => Promise<IAsunaEvent[]> | IAsunaEvent[],
  ): void {
    logger.log(`reg resolver: ${tag}`);
    CqrsService.resolvers[tag] = resolver;
  }

  private async resolveCommandToEvents(command: IAsunaCommand): Promise<any[]> {
    const promised = await Promise.all(
      _.chain(CqrsService.resolvers)
        .map(
          async (
            resolver: (command: IAsunaCommand) => Promise<IAsunaEvent[]> | IAsunaEvent[],
            tag: string,
          ) => {
            logger.debug(`try send to ${tag} ...`);
            const events = await resolver(command);
            if (events && events.length) {
              logger.debug(`resolve [${tag}]: ${JSON.stringify(events)}`);
            }
            return events;
          },
        )
        .values()
        .value(),
    );
    return _.flatten(promised);
  }
}
