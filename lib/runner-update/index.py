from os import environ
from logging import getLogger, INFO
from boto3 import client
from botocore.exceptions import ClientError

logger = getLogger()
logger.setLevel(INFO)

app = client('apprunner')

def handler(event, context):
  service_arn = environ['SERVICE_ARN']
  image_repo = environ['IMAGE_REPO']
  try:
    image_id = image_repo + ':latest'
    update_service_image_id(service_arn, image_id)
  except ClientError as e:
    logger.error('Client Error: %s', e)
    raise e
  return

def update_service_image_id(arn, image_id):
  service_stat = app.describe_service(ServiceArn=arn)
  src_config = service_stat['Service']['SourceConfiguration']
  src_config['ImageRepository']['ImageIdentifier'] = image_id
  app.update_service(
    ServiceArn=arn,
    SourceConfiguration=src_config
  )
  return
