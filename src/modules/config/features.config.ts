import { ConfigureLoader, YamlConfigKeys } from '../core/config';

export enum FeaturesConfigKeys {
  auditEnable = 'audit_enable',
  swaggerEnable = 'swagger_enable',
  cronEnable = 'cron_enable',
  errorStats = 'error_stats',
  webTracingEnabled = 'web_tracing_enabled',
  apmEnabled = 'apm_enabled',
  apmServiceName = 'apm.service_name',
  apmServerUrl = 'apm.server_url',
  apmSecretToken = 'apm.secret_token',
  quickpassEnabled = 'quickpass_enabled',
  quickpassApiKeyRequired = 'quickpass_api_key_required',
  dynamicRouter = 'dynamic_router',
  paymentEnable = 'payment_enable',
}

export class FeaturesConfigObject implements Record<keyof typeof FeaturesConfigKeys, any> {
  public auditEnable: boolean;
  public swaggerEnable: boolean;
  public cronEnable: boolean;
  public errorStats: boolean;
  public webTracingEnabled: boolean;
  public apmEnabled: boolean;
  public apmServiceName: string;
  public apmServerUrl: string;
  public apmSecretToken: string;
  public quickpassEnabled: boolean;
  public quickpassApiKeyRequired: boolean;
  public dynamicRouter: boolean;
  public paymentEnable: boolean;
}

export interface FeaturesConfigure extends ConfigureLoader<FeaturesConfigObject> {}
@ConfigureLoader(YamlConfigKeys.features, FeaturesConfigKeys, FeaturesConfigObject, () => ({
  [FeaturesConfigKeys.dynamicRouter]: false,
}))
export class FeaturesConfigure {}
