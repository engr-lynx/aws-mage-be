from os import environ
from logging import getLogger, INFO
from boto3 import client
from botocore.exceptions import ClientError

logger = getLogger()
logger.setLevel(INFO)

cp = client('codepipeline')

def handler(event, context):
  pipeline_name = environ['PIPELINE_NAME']
  try:
    start_pipeline(pipeline_name)
  except ClientError as e:
    logger.error('Client Error: %s', e)
    raise e
  return

def start_pipeline(pipeline_name):
  cp.start_pipeline_execution(
    name=pipeline_name
  )
  return