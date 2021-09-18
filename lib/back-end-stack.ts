import {
  Construct,
  Stack,
  StackProps,
} from '@aws-cdk/core'
import {
  Db,
} from './db'
import {
  Es,
} from './es'
import {
  Web,
} from './web'
import {
  ComponentsConfig,
} from './config'

export interface BackEndProps extends StackProps, ComponentsConfig {}

export class BackEndStack extends Stack {
  constructor(scope: Construct, id: string, props: BackEndProps) {
    super(scope, id, props)
    const db = new Db(this, 'Db', {
      ...props.db,
    })
    const es = new Es(this, 'Es', {
      ...props.es,
    })
    new Web(this, 'Web', {
      ...props.web,
      dbHost: db.host,
      dbName: db.name,
      dbSecret: db.secret,
      esHost: es.host,
      esSecret: es.secret,
    })
  }
}
