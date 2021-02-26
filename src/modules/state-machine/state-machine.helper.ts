import * as _ from 'lodash';
import { r } from '../common/helpers/utils';
import { LoggerFactory } from '../common/logger';

const logger = LoggerFactory.getLogger('StateMachine');

export interface StateMachineAction<Action, State> {
  type: Action;
  from: State;
  to: State;
}

export interface StateJson<StatusType, ActionType> {
  key: string;
  stateKey: string;
  actionKey: string;
  defaultState: StatusType;
  actions: StateMachineAction<ActionType, StatusType>[];
}

export abstract class AbstractStateMachine<StatusType, ActionType> {
  public constructor(
    public readonly key: string,
    public readonly stateKey: string,
    public readonly actionKey: string,
    public readonly defaultState: StatusType,
    public readonly actions: StateMachineAction<ActionType, StatusType>[],
  ) {}

  public do(from: StatusType, type: ActionType): StatusType {
    const found = _.find(this.actions, (action) => action.from === from && action.type === type);
    logger.debug(`do ${this.key} ${r({ found, from, type })}`);
    return found?.to ?? from;
  }

  public toJson(): StateJson<StatusType, ActionType> {
    return {
      key: this.key,
      stateKey: this.stateKey,
      actionKey: this.actionKey,
      defaultState: this.defaultState,
      actions: this.actions,
    };
  }
}
