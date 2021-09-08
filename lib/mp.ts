import {
  Construct,
} from '@aws-cdk/core'
import {
  Secret,
  ISecret,
} from '@aws-cdk/aws-secretsmanager'
import {
  MpConfig,
} from './config'

export interface MpProps extends MpConfig {}

export class Mp extends Construct {

  public readonly secret: ISecret

  constructor(scope: Construct, id: string, mpProps: MpProps) {
    super(scope, id)
    this.secret = Secret.fromSecretNameV2(this, 'MpCredentials', mpProps.secretName)
  }

}
