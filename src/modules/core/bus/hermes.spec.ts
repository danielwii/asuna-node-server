import 'jest';
import { r } from '../../common/helpers';
import { AbstractAuthUser } from '../auth';
import {
  AsunaDefaultEvent,
  AsunaSystemQueue,
  Hermes,
  HermesExchange,
  HermesProcessManager,
} from './hermes';
import { IAsunaAction, IAsunaCommand, IAsunaEvent, IAsunaJob, IAsunaRule } from './interfaces';

describe('Hermes', () => {
  beforeAll(async () => {});

  afterAll(async () => {});

  it('simulate user upload command', () => {
    const command = new (class UploadCommand implements IAsunaCommand {
      createdAt: any;
      createdBy: any;
      events: IAsunaEvent[];
      extra: object;
      name: string = 'upload portrait';
      payload: any = { filepath: 'somewhere' };
      service: string = 'user.upload';
      tracking: object;
      version: string = 'default/v1alpha';
      type: string = 'Command';
      user: AbstractAuthUser;
    })();

    HermesExchange.regCommandResolver('upload-command-resolver', {
      identifier: { version: 'default/v1alpha', type: 'Command' },
      resolve: command => {
        console.log(`resolve command to actions ${r(command)}`);
        return [
          new AsunaDefaultEvent(
            'default-upload-event',
            'test',
            'UploadEvent',
            { data: 'test' },
            ({ payload }) => {
              console.log({ payload });
              return Promise.resolve('done');
            },
          ),
          /*
          new (class UploadEvent implements IAsunaEvent {
            createdAt: any;
            createdBy: any;
            name: string;
            payload: any;
            rules: IAsunaRule[];
            source: string;
            type: string;
          })(),*/
        ];
      },
    });
    /*
    HermesExchange.regEventRule('upload-event-rule-default', {
      identifier: { version: 'default/v1alpha', type: 'EventRule' },
      resolve: event => {
        console.log(`resolve event to actions ${r(event)}`);
        return [
          new (class UploadAction implements IAsunaAction {
            createdAt: any;
            createdBy: any;
            name: string;
            payload: any;
            jobs: IAsunaJob[];
            source: string;
            type: string;
          })(),
        ];
      },
    });
*/

    HermesProcessManager.start();
    console.log(1, command);

    HermesProcessManager.handleCommand(command);
    console.log(2, command);
    console.log(3, JSON.stringify(Hermes.getInMemoryQueue(AsunaSystemQueue.IN_MEMORY_JOB).status));
    return new Promise(resolve => {
      setTimeout(() => {
        console.log(
          4,
          JSON.stringify(Hermes.getInMemoryQueue(AsunaSystemQueue.IN_MEMORY_JOB).status),
        );
        resolve();
      }, 1000);
    });
  });
});
