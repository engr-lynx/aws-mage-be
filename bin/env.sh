NODE_VERSION="14.17.6"
nvm install ${NODE_VERSION}
nvm use ${NODE_VERSION}
nvm alias default ${NODE_VERSION}
export PATH="/home/ec2-user/.yarn/bin:$PATH"
