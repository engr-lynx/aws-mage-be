import {
  Construct,
  Stack,
  RemovalPolicy,
} from '@aws-cdk/core'
import {
  Domain,
  ElasticsearchVersion,
} from '@aws-cdk/aws-elasticsearch'
import {
  Vpc,
  SubnetType,
} from '@aws-cdk/aws-ec2'
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
    // !ToDo(3): Does useUnsignedBasicAuth make the build slower? If so, can App Runner Role be created to access this?
    const capacity = {
      dataNodeInstanceType: props.instance,
    }
    const vpc = Vpc.fromLookup(this, 'DefaultVpc', {
      isDefault: true,
    })
    const availabilityZones = Stack.of(this).availabilityZones
    const vpcSubnets = availabilityZones.map(az => {
      return {
        availabilityZones: [az],
        subnetType: SubnetType.PUBLIC,
      }
    })
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
      vpc,
      vpcSubnets,
      useUnsignedBasicAuth: true,
      fineGrainedAccessControl,
      removalPolicy,
    })
    this.host = 'https://' + domain.domainEndpoint
  }

}
