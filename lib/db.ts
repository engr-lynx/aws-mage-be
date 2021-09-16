import {
  Construct,
  RemovalPolicy,
} from '@aws-cdk/core'
import {
  Secret,
  ISecret,
} from '@aws-cdk/aws-secretsmanager'
import {
  InstanceType,
  Vpc,
  SubnetType,
  SecurityGroup,
  Port,
  Peer,
} from '@aws-cdk/aws-ec2'
import {
  DatabaseCluster,
  DatabaseClusterEngine,
  AuroraMysqlEngineVersion,
  Credentials,
} from '@aws-cdk/aws-rds'
import {
  DbConfig,
} from './config'

export interface DbProps extends DbConfig {}

export class Db extends Construct {

  public readonly host: string
  public readonly name: string
  public readonly secret: ISecret

  constructor(scope: Construct, id: string, props: DbProps) {
    super(scope, id)
    // ToDo: Use ServerlessCluster?!
    const engine = DatabaseClusterEngine.auroraMysql({
      version: AuroraMysqlEngineVersion.of('5.7.mysql_aurora.2.09.2'),
    })
    const instanceType = props.instance ?
      new InstanceType(props.instance) :
      undefined
    const vpc = Vpc.fromLookup(this, 'DefaultVpc', {
      isDefault: true,
    })
    const vpcSubnets = {
      subnetType: SubnetType.PUBLIC,
    }
    const sg = new SecurityGroup(this, 'Sg', {
      vpc,
    })
    sg.addIngressRule(Peer.anyIpv4(), Port.tcp(3306))
    const securityGroups = [sg]
    const instanceProps = {
      instanceType,
      vpc,
      vpcSubnets,
      securityGroups,
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
    const credentials = Credentials.fromSecret(this.secret)
    this.name = props.name
    const removalPolicy = props.deleteWithApp ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN
    const cluster = new DatabaseCluster(this, 'Cluster', {
      engine,
      instanceProps,
      instances: 1,
      credentials,
      defaultDatabaseName: this.name,
      removalPolicy,
    })
    this.host = cluster.clusterEndpoint.hostname
  }

}
