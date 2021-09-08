#!/usr/bin/env node
import 'source-map-support/register'
import {
  App,
} from '@aws-cdk/core'
import {
  BackEndStack,
} from '../lib/back-end-stack'

const app = new App()
new BackEndStack(app, 'BackEndStack')
