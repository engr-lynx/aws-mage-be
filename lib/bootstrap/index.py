from os import environ, path
from json import dumps
from shutil import make_archive
from logging import getLogger, INFO
from boto3 import resource, client
from botocore.exceptions import ClientError

logger = getLogger()
logger.setLevel(INFO)

s3 = resource('s3')
app = client('apprunner')

def handler(event, context):
  logger.info('Received event: %s' % dumps(event))
  request_type = event['RequestType']
  if request_type == 'Create': return bootstrap(event)
  if request_type == 'Update': return bootstrap(event)
  if request_type == 'Delete': return
  raise Exception('Invalid request type: %s' % request_type)

def bootstrap(event):
  service_arn = event['ResourceProperties']['serviceArn']
  image_repo = event['ResourceProperties']['imageRepo']
  src_bucket = event['ResourceProperties']['srcBucket']
  src_key = event['ResourceProperties']['srcKey']
  try:
    image_id = image_repo + ':latest'
    update_service_image_id(service_arn, image_id)
    src_path = path.join(environ['LAMBDA_TASK_ROOT'], 'src')
    zip_path = path.join('/tmp', src_key)
    compress_dir(src_path, zip_path)
    upload_src(zip_path, src_bucket, src_key)
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

def compress_dir(dir_path, out_filename):
  out_parts = path.splitext(out_filename)
  make_archive(out_parts[0], out_parts[1][1:], dir_path, './')
  return

def upload_src(zip_path, bucket, key):
  s3.meta.client.upload_file(zip_path, bucket, key)
  return
