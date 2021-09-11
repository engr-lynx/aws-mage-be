#!/usr/bin/env node
import 'source-map-support/register'
import {
  App,
} from '@aws-cdk/core'
import {
  AppConfig,
} from '../lib/config'
import {
  BackEndStack,
} from '../lib/back-end-stack'

const app = new App()
const appContext = app.node.tryGetContext('app')
const appConfig = appContext as AppConfig
new BackEndStack(app, appConfig.name, {
  ...appConfig.services,
})
