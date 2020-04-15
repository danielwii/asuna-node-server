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
    const found = this.actions.find((action) => action.from === from && action.type === type);
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
