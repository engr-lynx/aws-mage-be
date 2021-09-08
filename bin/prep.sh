# Install dependencies
sudo yum -y install jq
npm install -g yarn
yarn global add --force aws-cdk

# Grow storage
# ToDo: Use CF output or SSM on dev-env and pick values up here.
# ToDo: Add Secrets Manager credentials creation for Magento marketplace here. Put credentials on cdk.context.yaml once it's git ignored.
C9_NAME=C9forSS
CF_NAME=$(aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE | jq -r --arg C9_NAME ${C9_NAME} '.StackSummaries[] | select(.StackName| contains($C9_NAME)) | .StackName')
EC2_ID=$(aws cloudformation list-stack-resources --stack-name ${CF_NAME} | jq -r '.StackResourceSummaries[] | select(.LogicalResourceId == "Instance") | .PhysicalResourceId')
VOL_ID=$(aws ec2 describe-instances --instance-ids ${EC2_ID} | jq -r '.Reservations[0].Instances[0].BlockDeviceMappings[0].Ebs.VolumeId')
aws ec2 modify-volume --volume-id ${VOL_ID} --size 50
until [ $(aws ec2 describe-volumes-modifications --volume-id ${VOL_ID} | jq '.VolumesModifications[0].ModificationState') != "modifying" ]; do : ; done

# Use storage
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

# Copy sample CDK context
cp cdk.context.sample.yaml cdk.context.yaml
