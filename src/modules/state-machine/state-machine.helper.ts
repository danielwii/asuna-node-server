import * as _ from 'lodash';
import { r } from '../common/helpers/utils';
import { LoggerFactory } from '../common/logger';

const logger = LoggerFactory.getLogger('StateMachine');

export type StateMachineAction<Action, State> = { type: Action; from: State; to: State };

export abstract class AbstractStateMachine<StatusType, ActionType> {
  constructor(
    public readonly key,
    public readonly stateKey,
    public readonly actionKey,
    public readonly defaultState,
    public readonly actions: StateMachineAction<ActionType, StatusType>[],
  ) {}

  do(from: StatusType, type: ActionType): StatusType {
    const found = _.find(this.actions, (action) => action.from === from && action.type === type);
    logger.debug(`do ${this.key} ${r({ found, from, type })}`);
    return found?.to ?? from;
  }

  toJson(): object {
    return {
      key: this.key,
      stateKey: this.stateKey,
      actionKey: this.actionKey,
      defaultState: this.defaultState,
      actions: this.actions,
    };
  }
}
