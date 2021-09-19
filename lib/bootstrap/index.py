from os import environ, path
from shutil import make_archive
from logging import getLogger, INFO
from boto3 import resource
from botocore.exceptions import ClientError

logger = getLogger()
logger.setLevel(INFO)

s3 = resource('s3')

def handler(event, context):
  src_bucket = environ['SRC_BUCKET']
  src_key = environ['SRC_KEY']
  try:
    src_path = path.join(environ['LAMBDA_TASK_ROOT'], 'src')
    zip_path = path.join('/tmp', src_key)
    compress_dir(src_path, zip_path)
    upload_src(zip_path, src_bucket, src_key)
  except ClientError as e:
    logger.error('Client Error: %s', e)
    raise e
  return

def compress_dir(dir_path, out_filename):
  out_parts = path.splitext(out_filename)
  make_archive(out_parts[0], out_parts[1][1:], dir_path, './')
  return

def upload_src(zip_path, bucket, key):
  s3.meta.client.upload_file(zip_path, bucket, key)
  return
