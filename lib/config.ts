import {
  DeployableAppConfig,
} from '@engr-lynx/cdk-pipeline-builder'

export interface MpConfig {
  readonly secretName: string,
}

export interface NetworkConfig {
  readonly azCount?: number,
}

export interface DbConfig {
  readonly name: string,
  readonly username: string,
  readonly deleteWithApp?: boolean,
  readonly instance?: string,
  readonly network?: NetworkConfig,
}

export interface EsConfig {
  readonly username: string,
  readonly deleteWithApp?: boolean,
  readonly instance?: string,
}

interface AdminConfig {
  readonly secretName: string,
}

interface ContInstance {
  readonly cpu?: string,
  readonly memory?: string,
}

export interface WebConfig extends DeployableAppConfig {
  readonly admin: AdminConfig,
  readonly instance?: ContInstance,
}

export interface ServicesConfig {
  readonly mp: MpConfig,
  readonly db: DbConfig,
  readonly es: EsConfig,
  readonly web: WebConfig,
}

export interface AppConfig {
  readonly name: string,
  readonly services: ServicesConfig,
}
