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

export class BackEndStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)
    const servicesContext = this.node.tryGetContext('services')
    const servicesConfig = servicesContext as ServicesConfig
    const mp = new Mp(this, 'Mp', {
      ...servicesConfig.mp,
    })
    const db = new Db(this, 'Db', {
      ...servicesConfig.db,
    })
    const es = new Es(this, 'Es', {
      ...servicesConfig.es,
    })
    new Web(this, 'Web', {
      ...servicesConfig.web,
      mpSecret: mp.secret,
      dbHost: db.host,
      dbName: db.name,
      dbSecret: db.secret,
      esHost: es.host,
      esSecret: es.secret,
    })
  }
}
