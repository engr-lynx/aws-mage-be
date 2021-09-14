import {
  DeployableAppConfig,
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
  deleteWithApp: boolean,
  network: NetworkConfig,
}

export interface EsConfig {
  username: string,
  deleteWithApp: boolean,
}

interface AdminConfig {
  secretName: string,
}

export interface WebConfig extends DeployableAppConfig {
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
