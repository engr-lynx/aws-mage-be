# Deploy project
yarn
npx yaml2json cdk.context.yaml > cdk.context.json
export ACCOUNT=$(aws sts get-caller-identity | jq -r .Account)
export REGION=$(aws configure get region)
cdk bootstrap aws://${ACCOUNT}/${REGION}
cdk deploy --require-approval never
