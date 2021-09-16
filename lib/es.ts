import {
  Construct,
  RemovalPolicy,
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

  constructor(scope: Construct, id: string, props: EsProps) {
    super(scope, id)
    const capacity = {
      dataNodeInstanceType: props.instance,
    }
    const secretStringTemplate = JSON.stringify({
      username: props.username,
    })
    const generateSecretString = {
      excludeCharacters: '" %+=~`@#$^&()|[]{}:;,<>?!\'\\/)*',
      requireEachIncludedType: true,
      secretStringTemplate,
      generateStringKey: 'password',
    }
    this.secret = new Secret(this, 'Credentials', {
      generateSecretString,
    })
    const fineGrainedAccessControl = {
      masterUserName: this.secret.secretValueFromJson('username').toString(),
      masterUserPassword: this.secret.secretValueFromJson('password'),
    }
    const removalPolicy = props.deleteWithApp ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN
    const domain = new Domain(this, 'Domain', {
      version: ElasticsearchVersion.V7_9,
      capacity,
      useUnsignedBasicAuth: true,
      fineGrainedAccessControl,
      removalPolicy,
    })
    this.host = 'https://' + domain.domainEndpoint
  }

}
