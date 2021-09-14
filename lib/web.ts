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
  Secret,
  ISecret,
} from '@aws-cdk/aws-secretsmanager'
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
  createSourceAction,
  createImageBuildAction,
  createPipeline,
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

  // ToDo: Split the process into: (1) bootstrap pipeline that creates the project and (2) standard CI/CD pipeline that builds and deploys it.
  // ToDo: Separate service runner creation from the creation of the pipelines.
  // ToDo: Is there a way to self-destroy bootstrap pipeline after successful execution?
  // ToDo: Transfer update_service_image_id to end of bootstrap pipeline to make sure ECR already has an image.
  // ToDo: Right-size App Runner instance (to 1 vCPU & 2GB).
  constructor(scope: Construct, id: string, webProps: WebProps) {
    super(scope, id)
    const stages = []
    const sourceActionProps = {
      ...webProps.pipeline.source,
      key: 'src.zip',
    }
    const {
      action: s3Source,
      sourceArtifact: sourceCode,
      source,
    } = createSourceAction(this, sourceActionProps)
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
    // ToDo: Allow other settings.
    const serviceRunner = new ImageServiceRunner(this, 'ServiceRunner', {
      repositoryType: RepositoryType.ECR,
      imageId,
      port: "80",
      willAutoDeploy: true,
    })
    const baseUrl = 'https://' + serviceRunner.service.attrServiceUrl
    const inEnvVarArgs = {
      BASE_URL: baseUrl,
      DB_HOST: webProps.dbHost,
      DB_NAME: webProps.dbName,
      ES_HOST: webProps.esHost,
    }
    const adminSecret = Secret.fromSecretNameV2(this, 'AdminDetails', webProps.admin.secretName)
    const inEnvSecretArgs = {
      DB_USERNAME: webProps.dbSecret.secretName + ':username',
      DB_PASSWORD: webProps.dbSecret.secretName + ':password',
      ES_USERNAME: webProps.esSecret.secretName + ':username',
      ES_PASSWORD: webProps.esSecret.secretName + ':password',
      MP_USERNAME: webProps.mpSecret.secretName + ':username',
      MP_PASSWORD: webProps.mpSecret.secretName + ':password',
      ADMIN_FIRSTNAME: adminSecret.secretName + ':firstName',
      ADMIN_LASTNAME: adminSecret.secretName + ':lastName',
      ADMIN_EMAIL: adminSecret.secretName + ':email',
      ADMIN_URL_PATH: adminSecret.secretName + ':urlPath',
      ADMIN_USERNAME: adminSecret.secretName + ':username',
      ADMIN_PASSWORD: adminSecret.secretName + ':password',
    }
    const {
      action: buildAction,
      imageRepo,
      grantee,
    } = createImageBuildAction(this, {
      ...webProps.pipeline.build,
      inEnvVarArgs,
      inEnvSecretArgs,
      sourceCode,
    })
    webProps.dbSecret.grantRead(grantee)
    webProps.esSecret.grantRead(grantee)
    webProps.mpSecret.grantRead(grantee)
    adminSecret.grantRead(grantee)
    const buildActions = [
      buildAction,
    ]
    const buildStage = {
      stageName: 'Build',
      actions: buildActions,
    }
    stages.push(buildStage)
    const pipeline = createPipeline(this, {
      ...webProps.pipeline,
      stages,
      restartExecutionOnUpdate: true,
    })
    // !ToDo: Put PythonFunction + Provider + CustomResource in a module. Then, remove dependencies @aws-cdk/aws-lambda-python and @aws-cdk/custom-resources.
    const entry = join(__dirname, 'bootstrap')
    const onEventHandler = new PythonFunction(this, 'Bootstrap', {
      entry,
    })
    // ToDo: Aggregate grants to read, write and read-write
    serviceRunner.service.grantUpdate(onEventHandler)
    bucket.grantPut(onEventHandler)
    const provider = new Provider(this, 'BootstrapProvider', {
      onEventHandler,
    })
    const properties = {
      serviceArn: serviceRunner.service.attrServiceArn,
      imageRepo: imageRepo.repositoryUri,
      srcBucket: bucket.bucketName,
      srcKey: sourceActionProps.key,
    }
    const bootstrapResource = new CustomResource(this, 'BootstrapResource', {
      serviceToken: provider.serviceToken,
      properties,
    })
    // This custom resource will trigger pipeline. Hence the latter needs to be fully created first.
    bootstrapResource.node.addDependency(pipeline)
  }

}
