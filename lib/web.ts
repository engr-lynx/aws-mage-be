import {
  join,
} from 'path'
import {
  Construct,
  RemovalPolicy,
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
  StackRemovableRepository,
  ImageServiceRunner,
  RepositoryType,
} from '@engr-lynx/cdk-service-patterns'
import {
  SourceAction,
  SourceType,
  ImageBuildAction,
  StartablePipeline,
} from '@engr-lynx/cdk-pipeline-builder'
import {
  ForkedRepository,
} from '@engr-lynx/cdk-forked-codecommit'
import {
  ECRDeployment,
  DockerImageName,
} from 'cdk-ecr-deployment'
import {
  AfterCreate,
} from 'cdk-triggers'
import {
  WebConfig,
} from './config'

export interface WebProps extends WebConfig {
  readonly dbHost: string,
  readonly dbName: string,
  readonly dbSecret: ISecret,
  readonly esHost: string,
  readonly esSecret: ISecret,
}

export class Web extends Construct {

  // !ToDo: Use a code repo w/ created project containing sample data to reduce build time. Will need composer to install dependencies.
  constructor(scope: Construct, id: string, props: WebProps) {
    super(scope, id)
    const stages = []
    const repo = new ForkedRepository(this, 'Repo', {
      repositoryName: props.repoName,
      srcRepo: props.sourceRepo,
    })
    const sourceAction = new SourceAction(this, 'SourceAction', {
      type: SourceType.CodeCommit,
      name: repo.repositoryName,
    })
    const sourceActions = [
      sourceAction.action,
    ]
    const sourceStage = {
      stageName: 'Source',
      actions: sourceActions,
    }
    stages.push(sourceStage)
    const removalPolicy = props.deleteImageRepoWithApp ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN
    const imageRepo = new StackRemovableRepository(this, 'ImageRepo', {
      removalPolicy,
    })
    const directory = join(__dirname, 'base-image')
    const baseImage = new DockerImageAsset(this, 'BaseImage', {
      directory,
    })
    const src = new DockerImageName(baseImage.imageUri)
    const dest = new DockerImageName(imageRepo.repositoryUri)
    const baseImageEcr = new ECRDeployment(this, 'BaseImageEcr', {
      src,
      dest,
    })
    const imageId = imageRepo.repositoryUri + ':latest'
    // ToDo: Allow other settings.
    const serviceRunner = new ImageServiceRunner(this, 'ServiceRunner', {
      repositoryType: RepositoryType.ECR,
      imageId,
      port: "80",
      willAutoDeploy: true,
      cpu: props?.instance?.cpu,
      memory: props?.instance?.memory,
    })
    serviceRunner.node.addDependency(baseImageEcr)
    const baseUrl = 'https://' + serviceRunner.serviceUrl
    const deploySample = props.deploySample ?? false
    const inEnvVarArgs = {
      BASE_URL: baseUrl,
      DEPLOY_SAMPLE: deploySample.toString(),
      DB_HOST: props.dbHost,
      DB_NAME: props.dbName,
      ES_HOST: props.esHost,
    }
    const adminSecret = Secret.fromSecretNameV2(this, 'AdminDetails', props.adminSecretName)
    const mpSecret = Secret.fromSecretNameV2(this, 'MpCredentials', props.mpSecretName)
    const dbUsername = props.dbSecret.secretName + ':username'
    const dbPassword = props.dbSecret.secretName + ':password'
    const esUsername = props.esSecret.secretName + ':username'
    const esPassword = props.esSecret.secretName + ':password'
    const mpUsername = mpSecret.secretName + ':username'
    const mpPassword = mpSecret.secretName + ':password'
    const adminFirstName = adminSecret.secretName + ':firstName'
    const adminLastName = adminSecret.secretName + ':lastName'
    const adminEmail = adminSecret.secretName + ':email'
    const adminUrlPath = adminSecret.secretName + ':urlPath'
    const adminUsername = adminSecret.secretName + ':username'
    const adminPassword = adminSecret.secretName + ':password'
    const inEnvSecretArgs = {
      DB_USERNAME: dbUsername,
      DB_PASSWORD: dbPassword,
      ES_USERNAME: esUsername,
      ES_PASSWORD: esPassword,
      MP_USERNAME: mpUsername,
      MP_PASSWORD: mpPassword,
      ADMIN_FIRST_NAME: adminFirstName,
      ADMIN_LAST_NAME: adminLastName,
      ADMIN_EMAIL: adminEmail,
      ADMIN_URL_PATH: adminUrlPath,
      ADMIN_USERNAME: adminUsername,
      ADMIN_PASSWORD: adminPassword,
    }
    const imageBuildAction = new ImageBuildAction(this, 'ImageBuildAction', {
      ...props.pipeline.build,
      repoName: imageRepo.repositoryName,
      inEnvVarArgs,
      inEnvSecretArgs,
      sourceCode: sourceAction.sourceCode,
    })
    props.dbSecret.grantRead(imageBuildAction.project)
    props.esSecret.grantRead(imageBuildAction.project)
    mpSecret.grantRead(imageBuildAction.project)
    adminSecret.grantRead(imageBuildAction.project)
    const buildActions = [
      imageBuildAction.action,
    ]
    const buildStage = {
      stageName: 'Build',
      actions: buildActions,
    }
    stages.push(buildStage)
    const pipeline = new StartablePipeline(this, 'Pipeline', {
      ...props.pipeline,
      stages,
      restartExecutionOnUpdate: true,
    })
    const entry = join(__dirname, 'start-pipeline')
    const handler = new PythonFunction(this, 'Handler', {
      entry,
    })
    pipeline.grantStart(handler)
    handler.addEnvironment('PIPELINE_NAME', pipeline.pipelineName)
    const resources = [
      pipeline,
    ]
    new AfterCreate(this, 'StartPipeline', {
      resources,
      handler,
    })
  }

}
