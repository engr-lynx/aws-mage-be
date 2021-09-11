import {
  join,
} from 'path'
import {
  Construct,
  CustomResource,
} from '@aws-cdk/core'
import {
  DockerImageAsset,
} from '@aws-cdk/aws-ecr-assets'
import {
  ISecret,
} from '@aws-cdk/aws-secretsmanager'
import {
  Pipeline,
} from '@aws-cdk/aws-codepipeline'
import {
  PythonFunction,
} from '@aws-cdk/aws-lambda-python'
import {
  Bucket,
} from '@aws-cdk/aws-s3'
import {
  Provider,
} from '@aws-cdk/custom-resources'
import {
  ImageServiceRunner,
  RepositoryType,
} from '@engr-lynx/cdk-service-patterns'
import {
  buildSourceAction,
  buildContBuildAction,
} from '@engr-lynx/cdk-pipeline-builder'
import {
  WebConfig,
} from './config'

export interface WebProps extends WebConfig {
  mpSecret: ISecret,
  dbHost: string,
  dbName: string,
  dbSecret: ISecret,
  esHost: string,
  esSecret: ISecret,
}

export class Web extends Construct {

  constructor(scope: Construct, id: string, webProps: WebProps) {
    super(scope, id)
    const stages = []
    const sourceActionProps = {
      ...webProps.pipeline.source,
      key: 'src.zip',
    }
    const {
      action: s3Source,
      sourceArtifact,
      source,
    } = buildSourceAction(this, sourceActionProps)
    const bucket = source as Bucket
    const sourceActions = [
      s3Source,
    ]
    const sourceStage = {
      stageName: 'Source',
      actions: sourceActions,
    }
    stages.push(sourceStage)
    const directory = join(__dirname, 'base-image')
    const baseImage = new DockerImageAsset(this, 'BaseImage', {
      directory,
    })
    const imageId = baseImage.imageUri
    const serviceRunner = new ImageServiceRunner(this, 'ServiceRunner', {
      repositoryType: RepositoryType.ECR,
      imageId,
      port: "80",
      willAutoDeploy: true,
    })
    // ToDo: Take these from secrets manager directly. Also store admin credentials on Secrets Manager.
    const baseUrl = 'https://' + serviceRunner.service.attrServiceUrl
    const inKvArgs = {
      MP_USERNAME: webProps.mpSecret.secretValueFromJson('username').toString(),
      MP_PASSWORD: webProps.mpSecret.secretValueFromJson('password').toString(),
      BASE_URL: baseUrl,
      ADMIN_URL_PATH: webProps.admin.urlPath,
      ADMIN_FIRSTNAME: webProps.admin.firstName,
      ADMIN_LASTNAME: webProps.admin.lastName,
      ADMIN_EMAIL: webProps.admin.email,
      ADMIN_USERNAME: webProps.admin.username,
      ADMIN_PASSWORD: webProps.admin.password, 
      DB_HOST: webProps.dbHost,
      DB_NAME: webProps.dbName,
      DB_USERNAME: webProps.dbSecret.secretValueFromJson('username').toString(),
      DB_PASSWORD: webProps.dbSecret.secretValueFromJson('password').toString(),
      ES_HOST: webProps.esHost,
      ES_USERNAME: webProps.esSecret.secretValueFromJson('username').toString(),
      ES_PASSWORD: webProps.esSecret.secretValueFromJson('password').toString(),
    }
    const {
      action: buildAction,
      contRepo,
    } = buildContBuildAction(this, {
      ...webProps.pipeline.build,
      inKvArgs,
      sourceCode: sourceArtifact,
    })
    const buildActions = [
      buildAction,
    ]
    const buildStage = {
      stageName: 'Build',
      actions: buildActions,
    }
    stages.push(buildStage)
    const pipeline = new Pipeline(this, 'Pipeline', {
      stages,
      restartExecutionOnUpdate: true,
    })
    const entry = join(__dirname, 'bootstrap')
    const onEventHandler = new PythonFunction(this, 'Bootstrap', {
      entry,
    })
    serviceRunner.service.grantUpdate(onEventHandler)
    bucket.grantPut(onEventHandler)
    const bootstrapProvider = new Provider(this, 'BootstrapProvider', {
      onEventHandler,
    })
    const properties = {
      serviceArn: serviceRunner.service.attrServiceArn,
      imageRepo: contRepo.repositoryUri,
      srcBucket: bucket.bucketName,
      srcKey: sourceActionProps.key,
    }
    const bootstrapResource = new CustomResource(this, 'BootstrapResource', {
      serviceToken: bootstrapProvider.serviceToken,
      properties,
    })
    // This custom resource will trigger pipeline. Hence the latter needs to be fully created first.
    bootstrapResource.node.addDependency(pipeline)
  }

}
