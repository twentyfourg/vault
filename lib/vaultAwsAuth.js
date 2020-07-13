const AWS = require('aws-sdk');
const request = require('request');
const ConfigsClass = require('./configs');
const AwsSignedConfigs = require('./awsSignedConfigs');

class VaultAwsAuth {
  constructor(args) {
    const configs = new ConfigsClass(args);
    const validConfigs = configs.validateConfigs();
    if (!validConfigs.valid) {
      throw validConfigs.details;
    }
    this.configs = configs.getConfigs();
  }

  getOptions(creds) {
    const awsLoginConfigs = new AwsSignedConfigs({
      host: this.configs.host,
      vaultAppName: this.configs.vaultAppName,
      region: this.configs.region,
      awsRequestUrl: this.configs.awsRequestUrl,
    });
    const options = {
      url: this.configs.uri,
      followAllRedirects: this.configs.followAllRedirects,
      body: JSON.stringify(awsLoginConfigs.getSignedConfigs(creds)),
    };
    if (this.configs.sslCertificate) {
      options.cert = this.configs.sslCertificate;
    }
    if (!this.configs.sslRejectUnAuthorized) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }
    return options;
  }

  authenticate() {
    const providerChain = new AWS.CredentialProviderChain();
    return providerChain.resolvePromise().then((creds) => new Promise((resolve, reject) => {
      const options = this.getOptions(creds);
      request.post(options, (err, res, body) => {
        if (err) reject(err);
        else {
          const result = JSON.parse(body);
          if (result.errors) reject(result);
          else resolve(result);
        }
      });
    }));
  }
}

module.exports = VaultAwsAuth;
