import {
  join,
} from 'path'
import {
  Construct,
  CustomResource,
} from '@aws-cdk/core'
import {
  CfnServiceLinkedRole,
} from '@aws-cdk/aws-iam'
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
  AppRunnerService,
  IamRole,
  IamPolicy,
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
    const { action: s3Source, sourceArtifact, source } = buildSourceAction(this, sourceActionProps)
    const bucket = source as Bucket
    const sourceStage = {
      stageName: 'Source',
      actions: [
        s3Source,
      ],
    }
    stages.push(sourceStage)
    new CfnServiceLinkedRole(this, 'AppRunner', {
      awsServiceName: 'apprunner.amazonaws.com',
    })
    const repoUriVarName = 'REPO_URI'
    // ToDo: Take these from secrets manager directly. Also store admin credentials on Secrets Manager.
    const inKvArgs = {
      MP_USERNAME: webProps.mpSecret.secretValueFromJson('username').toString(),
      MP_PASSWORD: webProps.mpSecret.secretValueFromJson('password').toString(),
      BASE_URL: '',
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
    const roleName = 'AppRunnerECRAccessRole'
    const policyName = 'AWSAppRunnerServicePolicyForECRAccess'
    const serviceName = 'MagentoOnAWS'
    // ToDo: Create App Runner service and IAM role in this stack and outside CodeBuild. May need php-apache image asset to initially fill ECR. Test deployment and re-deployment.
    const prebuildCommands = [
      'SERVICE_ARN=$(aws apprunner list-services | jq -r \'.ServiceSummaryList[] | select(.ServiceName == "' + serviceName + '") | .ServiceArn\')',
      `if [ -z \${SERVICE_ARN} ]; then
        ROLE_ARN=\$(aws iam list-roles --path-prefix /service-role/ | jq -r '.Roles[] | select (.RoleName == "` + roleName + `") | .Arn')
        if [ -z \${ROLE_ARN} ]; then
          ROLE_ARN=\$(aws iam create-role --role-name ` + roleName + ` --path /service-role/ --assume-role-policy-document file://role.json | jq -r '.Role.Arn')
          POLICY_ARN=\$(aws iam list-policies --path-prefix /service-role/ --scope AWS --policy-usage-filter PermissionsPolicy | jq -r '.Policies[] | select(.PolicyName == "` + policyName + `") | .Arn')
          aws iam attach-role-policy --role-name ` + roleName + ` --policy-arn \${POLICY_ARN}
          until [ -n "\$(aws iam list-attached-role-policies --role-name ` + roleName + ` | jq '.AttachedPolicies[] | select(.PolicyName == "` + policyName + `")')" ]; do : ; done
        fi
        sed -i "s|{{` + repoUriVarName + `}}|\${` + repoUriVarName + `}|" app.json && sed -i "s|{{ROLE_ARN}}|\${ROLE_ARN}|" app.json
        export BASE_URL=https://\$(aws apprunner create-service --service-name ` + serviceName + ` --source-configuration file://app.json | jq -r .Service.ServiceUrl)
      else
        export BASE_URL=https://\$(aws apprunner describe-service --service-arn \${SERVICE_ARN} | jq -r .Service.ServiceUrl)
      fi`,
    ]
    const { action: buildAction, grantee: contProject } = buildContBuildAction(this, {
      ...webProps.pipeline.build,
      inKvArgs,
      prebuildCommands,
      sourceCode: sourceArtifact,
      repoUriVarName,
    })
    IamRole.grantList(contProject, this)
    IamRole.grantCreate(contProject, this)
    IamRole.grantAttachPolicy(contProject, this, roleName, true)
    IamRole.grantListAttachedPolicies(contProject, this, roleName, true)
    IamRole.grantPass(contProject, this, roleName, true)
    IamPolicy.grantList(contProject, this)
    AppRunnerService.grantList(contProject, this)
    AppRunnerService.grantDescribe(contProject, this, serviceName)
    AppRunnerService.grantCreate(contProject, this)
    const buildStage = {
      stageName: 'Build',
      actions: [
        buildAction,
      ],
    }
    stages.push(buildStage)
    const webPipeline = new Pipeline(this, 'WebPipeline', {
      stages,
      restartExecutionOnUpdate: true,
    })
    const entry = join(__dirname, 'web-trigger')
    const onEventHandler = new PythonFunction(this, 'Trigger', {
      entry,
    })
    bucket.grantPut(onEventHandler)
    bucket.grantDelete(onEventHandler)
    const triggerProvider = new Provider(this, 'TriggerProvider', {
      onEventHandler,
    })
    const properties = {
      bucket: bucket.bucketName,
      key: sourceActionProps.key,
    }
    const triggerResource = new CustomResource(this, 'TriggerResource', {
      serviceToken: triggerProvider.serviceToken,
      properties,
    })
    triggerResource.node.addDependency(webPipeline)
  }

}
