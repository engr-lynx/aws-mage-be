import {
  DeployableConfig,
} from '@engr-lynx/cdk-pipeline-builder'

export interface MpConfig {
  secretName: string,
}

export interface NetworkConfig {
  azCount?: number,
}

export interface DbConfig {
  name: string,
  username: string,
  network: NetworkConfig,
}

export interface EsConfig {
  username: string,
}

interface AdminConfig {
  urlPath: string,
  firstName: string,
  lastName: string,
  email: string,
  username: string,
  password: string,
}

export interface WebConfig extends DeployableConfig {
  admin: AdminConfig,
}

export interface ServicesConfig {
  mp: MpConfig,
  db: DbConfig,
  es: EsConfig,
  web: WebConfig,
}

export interface AppConfig {
  name: string,
  services: ServicesConfig,
}
