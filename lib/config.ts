import {
  DeployableAppConfig,
} from '@engr-lynx/cdk-pipeline-builder'

export interface DbConfig {
  readonly name: string,
  readonly username: string,
  readonly deleteWithApp?: boolean,
  readonly instance?: string,
}

export interface EsConfig {
  readonly username: string,
  readonly deleteWithApp?: boolean,
  readonly instance?: string,
}

interface ContInstance {
  readonly cpu?: string,
  readonly memory?: string,
}

export interface WebConfig extends DeployableAppConfig {
  readonly adminSecretName: string,
  readonly mpSecretName: string,
  readonly instance?: ContInstance,
}

export interface ComponentsConfig {
  readonly db: DbConfig,
  readonly es: EsConfig,
  readonly web: WebConfig,
}

export interface AppConfig {
  readonly name: string,
  readonly components: ComponentsConfig,
}
