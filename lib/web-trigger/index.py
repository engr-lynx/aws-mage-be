from os import environ, path
from json import dumps
from shutil import make_archive
from logging import getLogger, INFO
from boto3 import resource
from botocore.exceptions import ClientError

logger = getLogger()
logger.setLevel(INFO)

s3 = resource('s3')

def handler(event, context):
  logger.info('Received event: %s' % dumps(event))
  request_type = event['RequestType']
  if request_type == 'Create': return trigger(event)
  if request_type == 'Update': return trigger(event)
  if request_type == 'Delete': return
  raise Exception('Invalid request type: %s' % request_type)

def trigger(event):
  bucket = event['ResourceProperties']['bucket']
  key = event['ResourceProperties']['key']
  try:
    src_path = path.join(environ['LAMBDA_TASK_ROOT'], 'src')
    zip_path = path.join('/tmp', key)
    dir_compress(src_path, zip_path)
    upload(zip_path, bucket, key)
  except ClientError as e:
    logger.error('Client Error: %s', e)
    raise e
  return

def dir_compress(dirname, out_filename):
  out_parts = path.splitext(out_filename)
  if out_parts[1] != '.zip':
    raise ValueError('Only accepts zip format.')
  make_archive(out_parts[0], 'zip', dirname, './')
  return

def upload(zip_path, bucket, key):
  s3.meta.client.upload_file(zip_path, bucket, key)
  return
