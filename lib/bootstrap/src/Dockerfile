FROM public.ecr.aws/z0z6r0u2/magento2-php-apache:latest

# Create Magento2 project
ARG MP_USERNAME
ARG MP_PASSWORD
COPY ./conf/auth.json /root/.composer/
RUN sed -i "s/{{MP_USERNAME}}/${MP_USERNAME}/" /root/.composer/auth.json \
  && sed -i "s/{{MP_PASSWORD}}/${MP_PASSWORD}/" /root/.composer/auth.json \
  && composer create-project --repository-url=https://repo.magento.com/ magento/project-community-edition magento2

# Magento2 workdir
WORKDIR /var/www/html/magento2

# ToDo: Put deployment of sample data as optional (boolean in config)
# Deploy Magento2 sample data
RUN mkdir ./var/composer_home/ \
  && cp /root/.composer/auth.json ./var/composer_home/ \
  && bin/magento sampledata:deploy

# Install Magento2
ARG BASE_URL
ARG ADMIN_URL_PATH
ARG ADMIN_FIRSTNAME
ARG ADMIN_LASTNAME
ARG ADMIN_EMAIL
ARG ADMIN_USERNAME
ARG ADMIN_PASSWORD
ARG DB_HOST
ARG DB_NAME
ARG DB_USERNAME
ARG DB_PASSWORD
ARG ES_HOST
ARG ES_USERNAME
ARG ES_PASSWORD
RUN bin/magento setup:install \
    --base-url="${BASE_URL}" \
    --use-secure=0 \
    --use-secure-admin=0 \
    --session-save=db \
    --db-host="${DB_HOST}" \
    --db-name="${DB_NAME}" \
    --db-user="${DB_USERNAME}" \
    --db-password="${DB_PASSWORD}" \
    --search-engine=elasticsearch7 \
    --elasticsearch-host="${ES_HOST}" \
    --elasticsearch-port=443 \
    --elasticsearch-enable-auth=1 \
    --elasticsearch-username="${ES_USERNAME}" \
    --elasticsearch-password="${ES_PASSWORD}" \
    --backend-frontname="${ADMIN_URL_PATH}" \
    --admin-firstname="${ADMIN_FIRSTNAME}" \
    --admin-lastname="${ADMIN_LASTNAME}" \
    --admin-email="${ADMIN_EMAIL}" \
    --admin-user="${ADMIN_USERNAME}" \
    --admin-password="${ADMIN_PASSWORD}" \
    --language=en_US \
    --currency=USD \
    --timezone=America/Chicago \
    --use-rewrites=1 \
  && bin/magento cache:flush

# Set Magento2 for production mode w/ disabled 2FA
RUN bin/magento module:disable Magento_TwoFactorAuth \
  && bin/magento deploy:mode:set production \
  && bin/magento cache:flush \
  && chmod -R 777 var
