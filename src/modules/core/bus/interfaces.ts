import type { AbstractAuthUser } from '../auth/base.entities';

export interface IAsunaObserver {
  source: string;
  routePattern: 'fanout' | RegExp;
  next: (event: IAsunaEvent) => void;
}

export enum AsunaState {
  PENDING,
  IN_PROGRESS,
  FAILURE,
}

export interface IAsunaCommand {
  service: string;
  name: string;
  version: string;
  type: string;
  payload: any;
  user: AbstractAuthUser;
  extra?: object;
  tracking?: object;
  events?: IAsunaEvent[];
  createdBy: any;
  createdAt: any;
}

export interface IAsunaEvent {
  source: string;
  name: string;
  type: string;
  payload: any;
  rules: IAsunaRule[];
  createdBy: any;
  createdAt: any;
}

export interface IAsunaRule {
  source: string;
  name: string;
  type: string;
  payload: any;
  actions: IAsunaAction[];
  createdBy: any;
  createdAt: any;
}

export interface IAsunaAction {
  source: string;
  name: string;
  type: string;
  payload: any;
  jobs: IAsunaJob[];
  createdBy: any;
  createdAt: any;
}

export interface IAsunaJob {
  source: string;
  name: string;
  type: string;
  payload: any;
  createdBy: any;
  createdAt: any;
  process: (data) => Promise<any>;

  id?: string;
  state?: string;
}
