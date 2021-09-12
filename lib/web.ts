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
  createSourceAction,
  createImageBuildAction,
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
  // !ToDo: S3 deletion policy
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
    const serviceRunner = new ImageServiceRunner(this, 'ServiceRunner', {
      repositoryType: RepositoryType.ECR,
      imageId,
      port: "80",
      willAutoDeploy: true,
    })
    // !ToDo: Put store admin credentials on Secrets Manager.
    const baseUrl = 'https://' + serviceRunner.service.attrServiceUrl
    const inEnvVarArgs = {
      BASE_URL: baseUrl,
      ADMIN_URL_PATH: webProps.admin.urlPath,
      ADMIN_FIRSTNAME: webProps.admin.firstName,
      ADMIN_LASTNAME: webProps.admin.lastName,
      ADMIN_EMAIL: webProps.admin.email,
      ADMIN_USERNAME: webProps.admin.username,
      ADMIN_PASSWORD: webProps.admin.password, 
      DB_HOST: webProps.dbHost,
      DB_NAME: webProps.dbName,
      ES_HOST: webProps.esHost,
    }
    const inEnvSecretArgs = {
      MP_USERNAME: webProps.mpSecret.secretName + ':username',
      MP_PASSWORD: webProps.mpSecret.secretName + ':password',
      DB_USERNAME: webProps.dbSecret.secretName + ':username',
      DB_PASSWORD: webProps.dbSecret.secretName + ':password',
      ES_USERNAME: webProps.esSecret.secretName + ':username',
      ES_PASSWORD: webProps.esSecret.secretName + ':password',
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
    webProps.mpSecret.grantRead(grantee)
    webProps.dbSecret.grantRead(grantee)
    webProps.esSecret.grantRead(grantee)
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
    // ToDo: Put PythonFunction + Provider + CustomResource in a module.
    const entry = join(__dirname, 'bootstrap')
    const onEventHandler = new PythonFunction(this, 'Bootstrap', {
      entry,
    })
    // ToDo: Aggregate grants to read, write and read-write
    serviceRunner.service.grantUpdate(onEventHandler)
    bucket.grantPut(onEventHandler)
    const bootstrapProvider = new Provider(this, 'BootstrapProvider', {
      onEventHandler,
    })
    const properties = {
      serviceArn: serviceRunner.service.attrServiceArn,
      imageRepo: imageRepo.repositoryUri,
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
