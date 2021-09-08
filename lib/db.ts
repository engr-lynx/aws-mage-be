import {
  Construct,
} from '@aws-cdk/core'
import {
  Secret,
  ISecret,
} from '@aws-cdk/aws-secretsmanager'
import {
  Vpc,
  SubnetType,
  SecurityGroup,
  Peer,
  Port,
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

  constructor(scope: Construct, id: string, dbProps: DbProps) {
    super(scope, id)
    // ToDo: Use ServerlessCluster?!
    // ToDo: Right-size DB instance.
    // ToDo: Minimize the VPC.
    const engine = DatabaseClusterEngine.auroraMysql({
      version: AuroraMysqlEngineVersion.of('5.7.mysql_aurora.2.09.2'),
    })
    const subnetType = SubnetType.PUBLIC
    const publicSubnetConfig = {
      name: 'Public',
      subnetType,
    }
    const vpc = new Vpc(this, 'DbVpc', {
      maxAzs: dbProps.network.azCount,
      subnetConfiguration: [
        publicSubnetConfig,
      ],
    })
    const vpcSubnets = {
      subnetType,
    }
    const sg = new SecurityGroup(this, 'DbSg', {
      vpc,
    })
    sg.addIngressRule(Peer.anyIpv4(), Port.tcp(3306))
    const securityGroups = [sg]
    // ToDo: There is a publiclyAccessible property instead of vpc config?
    const instanceProps = {
      vpc,
      vpcSubnets,
      securityGroups,
    }
    const secretStringTemplate = JSON.stringify({
      username: dbProps.username,
    })
    const generateSecretString = {
      excludeCharacters: '" %+=~`@#$^&()|[]{}:;,<>?!\'\\/)*',
      requireEachIncludedType: true,
      secretStringTemplate,
      generateStringKey: 'password',
    }
    this.secret = new Secret(this, 'DbCredentials', {
      generateSecretString,
    })
    const credentials = Credentials.fromSecret(this.secret)
    this.name = dbProps.name
    const cluster = new DatabaseCluster(this, 'DbCluster', {
      engine,
      instanceProps,
      instances: 1,
      credentials,
      defaultDatabaseName: this.name,
    })
    this.host = cluster.clusterEndpoint.hostname
  }

}
