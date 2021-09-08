import {
  Construct,
} from '@aws-cdk/core'
import {
  Domain,
  ElasticsearchVersion,
} from '@aws-cdk/aws-elasticsearch'
import {
  Secret,
  ISecret,
} from '@aws-cdk/aws-secretsmanager'
import {
  EsConfig,
} from './config'

export interface EsProps extends EsConfig {}

export class Es extends Construct {

  public readonly host: string
  public readonly secret: ISecret

  constructor(scope: Construct, id: string, esProps: EsProps) {
    super(scope, id)
    // ToDo: Use application autoscaling?!
    // ToDo: Right-size ES instance.
    const secretStringTemplate = JSON.stringify({
      username: esProps.username,
    })
    const generateSecretString = {
      excludeCharacters: '" %+=~`@#$^&()|[]{}:;,<>?!\'\\/)*',
      requireEachIncludedType: true,
      secretStringTemplate,
      generateStringKey: 'password',
    }
    this.secret = new Secret(this, 'EsCredentials', {
      generateSecretString,
    })
    const fineGrainedAccessControl = {
      masterUserName: this.secret.secretValueFromJson('username').toString(),
      masterUserPassword: this.secret.secretValueFromJson('password'),
    }
    const domain = new Domain(this, 'EsDomain', {
      version: ElasticsearchVersion.V7_9,
      useUnsignedBasicAuth: true,
      fineGrainedAccessControl,
    })
    this.host = 'https://' + domain.domainEndpoint
  }

}
