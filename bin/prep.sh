# Install dependencies
sudo yum -y install jq
npm install -g yarn
yarn global add --force aws-cdk

# Grow storage
# !ToDo: Ask for C9 name.
C9_NAME=C9forSS
CF_NAME=$(aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE | jq -r --arg C9_NAME ${C9_NAME} '.StackSummaries[] | select(.StackName | contains($C9_NAME)) | .StackName')
EC2_ID=$(aws cloudformation list-stack-resources --stack-name ${CF_NAME} | jq -r '.StackResourceSummaries[] | select(.LogicalResourceId == "Instance") | .PhysicalResourceId')
VOL_ID=$(aws ec2 describe-instances --instance-ids ${EC2_ID} | jq -r '.Reservations[0].Instances[0].BlockDeviceMappings[0].Ebs.VolumeId')
aws ec2 modify-volume --volume-id ${VOL_ID} --size 50

# Use storage
until [ $(aws ec2 describe-volumes-modifications --volume-id ${VOL_ID} | jq -r '.VolumesModifications[0].ModificationState') == "optimizing" ]; do : ; done
DEV="/dev/nvme0n1"
PART=${DEV}"p1"
FS=$(df -hT | grep ${PART} | awk '{ print $2 }')
sudo growpart ${DEV} 1
if [ "${FS}" == "xfs" ]; then
  sudo xfs_growfs -d /
fi
if [ "${FS}" == "ext4" ]; then
  sudo resize2fs ${PART}
fi

# !ToDo: Ask for admin details and credentials and store in Secrets Manager. Read name from cdk.context.yaml. No need to .gitignore cdk.context.yaml.
# !ToDo: Ask for Magento marketplace credentials and store in Secrets Manager. Read name from cdk.context.yaml.
# !ToDo: Sample may be removed as soon as cdk.context.yaml remains relatively constant.
# Copy sample CDK context
cp cdk.context.sample.yaml cdk.context.yaml
