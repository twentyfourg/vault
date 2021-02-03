const { defaultProvider } = require('@aws-sdk/credential-provider-node');
const axios = require('axios');
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

  async authenticate() {
    const CredentialProvider = defaultProvider();
    const creds = await CredentialProvider();
    const options = await this.getOptions(creds);
    let response;
    try {
      response = await axios.post(options.url, options.body);
    } catch (axiosErrors) {
      throw axiosErrors.response.data;
    }
    return response.data;
  }
}

module.exports = VaultAwsAuth;
