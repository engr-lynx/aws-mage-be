import {
  join,
} from 'path'
import {
  Construct,
} from '@aws-cdk/core'
import {
  DockerImageAsset,
} from '@aws-cdk/aws-ecr-assets'
import {
  Secret,
  ISecret,
} from '@aws-cdk/aws-secretsmanager'
import {
  Bucket,
} from '@aws-cdk/aws-s3'
import {
  ImageServiceRunner,
  RepositoryType,
  PythonResource,
} from '@engr-lynx/cdk-service-patterns'
import {
  SourceAction,
  ImageBuildAction,
  createPipeline,
} from '@engr-lynx/cdk-pipeline-builder'
import {
  WebConfig,
} from './config'

export interface WebProps extends WebConfig {
  readonly mpSecret: ISecret,
  readonly dbHost: string,
  readonly dbName: string,
  readonly dbSecret: ISecret,
  readonly esHost: string,
  readonly esSecret: ISecret,
}

export class Web extends Construct {

  // !ToDo(2): Split the process into: (1) bootstrap pipeline that creates the project and (2) standard CI/CD pipeline that builds and deploys it. Then, separate service runner creation from the creation of the pipelines? Finally, is there a way to self-destroy bootstrap pipeline after successful execution?
  // !ToDo(2): Use a code repo w/ created project containing sample data to reduce build time. Will need composer to install dependencies.
  // !ToDo(2): Transfer update_service_image_id to end of bootstrap pipeline to make sure ECR already has an image (base-image if needed).
  constructor(scope: Construct, id: string, props: WebProps) {
    super(scope, id)
    const stages = []
    const sourceActionProps = {
      ...props.pipeline.source,
      key: 'src.zip',
    }
    const sourceAction = new SourceAction(this, 'SourceAction', sourceActionProps)
    const bucket = sourceAction.source as Bucket
    const sourceActions = [
      sourceAction.action,
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
      cpu: props?.instance?.cpu,
      memory: props?.instance?.memory,
    })
    const baseUrl = 'https://' + serviceRunner.serviceUrl
    const inEnvVarArgs = {
      BASE_URL: baseUrl,
      DB_HOST: props.dbHost,
      DB_NAME: props.dbName,
      ES_HOST: props.esHost,
    }
    const adminSecret = Secret.fromSecretNameV2(this, 'AdminDetails', props.admin.secretName)
    const inEnvSecretArgs = {
      DB_USERNAME: props.dbSecret.secretName + ':username',
      DB_PASSWORD: props.dbSecret.secretName + ':password',
      ES_USERNAME: props.esSecret.secretName + ':username',
      ES_PASSWORD: props.esSecret.secretName + ':password',
      MP_USERNAME: props.mpSecret.secretName + ':username',
      MP_PASSWORD: props.mpSecret.secretName + ':password',
      ADMIN_FIRSTNAME: adminSecret.secretName + ':firstName',
      ADMIN_LASTNAME: adminSecret.secretName + ':lastName',
      ADMIN_EMAIL: adminSecret.secretName + ':email',
      ADMIN_URL_PATH: adminSecret.secretName + ':urlPath',
      ADMIN_USERNAME: adminSecret.secretName + ':username',
      ADMIN_PASSWORD: adminSecret.secretName + ':password',
    }
    const imageBuildAction = new ImageBuildAction(this, 'ImageBuildAction', {
      ...props.pipeline.build,
      inEnvVarArgs,
      inEnvSecretArgs,
      sourceCode: sourceAction.sourceCode,
    })
    props.dbSecret.grantRead(imageBuildAction.project)
    props.esSecret.grantRead(imageBuildAction.project)
    props.mpSecret.grantRead(imageBuildAction.project)
    adminSecret.grantRead(imageBuildAction.project)
    const buildActions = [
      imageBuildAction.action,
    ]
    const buildStage = {
      stageName: 'Build',
      actions: buildActions,
    }
    stages.push(buildStage)
    const pipeline = createPipeline(this, {
      ...props.pipeline,
      stages,
      restartExecutionOnUpdate: true,
    })
    const entry = join(__dirname, 'bootstrap')
    const properties = {
      serviceArn: serviceRunner.serviceArn,
      imageRepo: imageBuildAction.repo.repositoryUri,
      srcBucket: bucket.bucketName,
      srcKey: sourceActionProps.key,
    }
    const bootstrapResource = new PythonResource(this, 'BootstrapResource', {
      entry,
      properties,
    })
    serviceRunner.grantReadWrite(bootstrapResource)
    bucket.grantPut(bootstrapResource)
    // !ToDo(1): Maybe this is not needed?
    // This custom resource will trigger pipeline. Hence the latter needs to be fully created first.
    bootstrapResource.node.addDependency(pipeline)
  }

}
