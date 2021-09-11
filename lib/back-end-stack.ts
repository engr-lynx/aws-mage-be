import {
  Construct,
  Stack,
  StackProps,
} from '@aws-cdk/core'
import {
  Mp,
} from './mp'
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
  ServicesConfig,
} from './config'

export interface BackEndProps extends StackProps, ServicesConfig {}

export class BackEndStack extends Stack {
  constructor(scope: Construct, id: string, backEndProps: BackEndProps) {
    super(scope, id, backEndProps)
    const mp = new Mp(this, 'Mp', {
      ...backEndProps.mp,
    })
    const db = new Db(this, 'Db', {
      ...backEndProps.db,
    })
    const es = new Es(this, 'Es', {
      ...backEndProps.es,
    })
    new Web(this, 'Web', {
      ...backEndProps.web,
      mpSecret: mp.secret,
      dbHost: db.host,
      dbName: db.name,
      dbSecret: db.secret,
      esHost: es.host,
      esSecret: es.secret,
    })
  }
}
