# Prompt user for required info
C9_NAME=C9forSS
read -p "Enter Cloud9 environment name (${C9_NAME}): " REPLY
if [ -n "${REPLY}" ]; then
  C9_NAME=${REPLY}
fi
read -p "Enter your first name: " ADMIN_FIRST_NAME
if [ -z "${ADMIN_FIRST_NAME}" ]; then
  exit 1
fi
read -p "Enter your last name: " ADMIN_LAST_NAME
if [ -z "${ADMIN_LAST_NAME}" ]; then
  exit 1
fi
read -p "Enter your email address: " ADMIN_EMAIL
if [ -z "${ADMIN_EMAIL}" ]; then
  exit 1
fi
ADMIN_URL_PATH=admin
read -p "Enter your desired URL path for the store back-end (${ADMIN_URL_PATH}): " REPLY
if [ -n "${REPLY}" ]; then
  ADMIN_URL_PATH=${REPLY}
fi
ADMIN_USERNAME=admin
read -p "Enter your desired admin username for the store back-end (${ADMIN_USERNAME}): " REPLY
if [ -n "${REPLY}" ]; then
  ADMIN_USERNAME=${REPLY}
fi
read -p "Enter your desired admin password for the store back-end: " ADMIN_PASSWORD
if [ -z "${ADMIN_PASSWORD}" ]; then
  exit 1
fi
read -p "Enter your Magento Marketplace public key: " MP_USERNAME
if [ -z "${MP_USERNAME}" ]; then
  exit 1
fi
read -p "Enter your Magento Marketplace private key: " MP_PASSWORD
if [ -z "${MP_PASSWORD}" ]; then
  exit 1
fi

echo "Please review that the following are correct. Proceed? (y/n): "
echo "your first name: ${ADMIN_FIRST_NAME}"
echo "your last name: ${ADMIN_LAST_NAME}"
echo "your email address: ${ADMIN_EMAIL}"
echo "store back-end URL PATH: ${ADMIN_URL_PATH}"
echo "store back-end admin username: ${ADMIN_USERNAME}"
echo "store back-end admin password: ${ADMIN_PASSWORD}"
echo "Magento Marketplace public key: ${MP_USERNAME}"
echo "Magento Marketplace private key: ${MP_PASSWORD}"
read -n 1 REPLY
if [ "${REPLY}" != 'y' ]; then
  exit 1
fi

# Install dependencies
sudo yum -y install jq
npm install -g yarn
yarn global add --force aws-cdk

# Grow storage
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

# Deploy project
yarn
npx yaml2json cdk.context.yaml > cdk.context.json

SECRET_FILE=secret.json
SECRET_NAME=$(cat cdk.context.json | jq -r '.app.services.mp.secretName')
jq --null-input \
  --arg username "${MP_USERNAME}" \
  --arg password "${MP_PASSWORD}" \
  '{"username": $username, "password": $password}' \
  > ${SECRET_FILE}
SECRET=$(aws secretsmanager list-secrets | jq -r --arg name "${SECRET_NAME}" '.SecretList[] | select(.Name == $name)')
if [ -z "${SECRET}" ]; then
  aws secretsmanager create-secret --name ${SECRET_NAME} --secret-string file://${SECRET_FILE}
else
  aws secretsmanager update-secret --secret-id ${SECRET_NAME} --secret-string file://${SECRET_FILE}
fi
rm -f ${SECRET_FILE}

SECRET_FILE=secret.json
SECRET_NAME=$(cat cdk.context.json | jq -r '.app.services.web.admin.secretName')
jq --null-input \
  --arg firstName "${ADMIN_FIRST_NAME}" \
  --arg lastName "${ADMIN_LAST_NAME}" \
  --arg email "${ADMIN_EMAIL}" \
  --arg urlPath "${ADMIN_URL_PATH}" \
  --arg username "${ADMIN_USERNAME}" \
  --arg password "${ADMIN_PASSWORD}" \
  '{"firstName": $firstName, "lastName": $lastName, "email": $email, "urlPath": $urlPath, "username": $username, "password": $password}' \
  > ${SECRET_FILE}
SECRET=$(aws secretsmanager list-secrets | jq -r --arg name "${SECRET_NAME}" '.SecretList[] | select(.Name == $name)')
if [ -z "${SECRET}" ]; then
  aws secretsmanager create-secret --name ${SECRET_NAME} --secret-string file://${SECRET_FILE}
else
  aws secretsmanager update-secret --secret-id ${SECRET_NAME} --secret-string file://${SECRET_FILE}
fi
rm -f ${SECRET_FILE}

export ACCOUNT=$(aws sts get-caller-identity | jq -r .Account)
export REGION=$(aws configure get region)
cdk bootstrap aws://${ACCOUNT}/${REGION}
cdk deploy --require-approval never
