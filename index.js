/**
 * @author Brian Anstett
 */

const fs = require('fs');
const debug = require('debug');
const os = require('os');
const Vault = require('./lib/vaultApi');
const VaultAwsAuth = require('./lib/vaultAwsAuth');

// For caching
const secretValues = {};

/**
 * fs promise is still experimental. fsReadFile is a promise wrapper around fs.readFile.
 * @param  {...any} args
 */
async function fsReadFile(...args) {
  return new Promise((resolve, reject) => {
    fs.readFile(...args, (error, data) => {
      if (error) return reject(error);
      return resolve(data);
    });
  });
}

/**
 * https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp_enable-regions.html#id_credentials_region-endpoints
 * @param {String} region AWS region
 * @returns {String} AWS STS region endpoint
 */
function getAwsRequestUrl(region) {
  const awsRegion = region || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;

  if (!awsRegion) throw new Error(`Valid region is required to determine AWS Request URL. Got ${awsRegion}.`);
  return `https://sts.${awsRegion}.amazonaws.com`;
}

/**
 * @param {string} [secret] Vault secret path
 * @param {Object} [options] Options object
 * @param {String} [options.vaultAddress] Vault endpoint to use. Defaults to VAULT_ADDR environment variable.
 * @param {String} [options.vaultTokenPath] Location of Vault session token on the file system. Defaults to VAULT_TOKEN_PATH environment variable
 * @param {Boolean} [options.bypassCache] Make a new API call for secrets instead of using cache.
 * @param {String} [options.vaultRole] Required if running in Lambda. What Vault role attempt to auth to.
 * @param {String} [options.scopedCredentialsRegion] Which region the STS signature is scoped to.
 * @param {string} [options.vaultToken] An existing Vault auth token to use.
 */
module.exports = async function getSecret(secretPath, options = {}) {
  // To be backwards compatible, we still use the KEY_NAME env var.
  // When secret manager is fully deprecated, we should swap this to SECRET_PATH
  let path = secretPath;
  if (!path) path = process.env.SECRET_PATH || process.env.KEY_NAME;

  // Default bypassCache to false
  const bypassCache = options.bypassCache || false;

  // Check if secret exists in cache
  if (secretValues[path] && bypassCache === false) return secretValues[path];

  // Default to environment variables
  const vaultAddress = options.vaultAddress || process.env.VAULT_ADDR; // Address for the Vault API.
  const vaultTokenPath = options.vaultTokenPath || process.env.VAULT_TOKEN_PATH || `${os.homedir()}/.vault-token`; // Required only for containers. Where on the FS the vault token lives.
  const vaultRole = options.vaultRole || process.env.VAULT_ROLE; // Required only for Lambda. What Vault role to auth to.
  const vaultPort = 443; // Port of the Vault API.
  let token = options.vaultToken || process.env.VAULT_TOKEN; // Use can pass in existing Vault token via options or environment variable.
  const scopedCredentialsRegion = options.awsScopedCredentialsRegion || process.env.VAULT_AWS_SCOPED_CREDENTIALS_REGION || 'us-east-1';
  let vaultClient;

  // If the user passed in an existing Vault token, you that. Don't go through the process of generating one
  if (token == null) {
    // Determine if being called in Lambda or container.
    if (process.env.AWS_EXECUTION_ENV) {
      // Running in Lambda. Make necessary assumptions.
      if (!vaultRole) throw new Error('Requires either options.vaultRole or VAULT_ROLE environment variable.');
      if (!scopedCredentialsRegion) throw new Error('Requires either options.scopedCredentialsRegion or VAULT_AWS_SCOPED_CREDENTIALS_REGION environment variable.');
      try {
        vaultClient = new VaultAwsAuth({
          host: vaultAddress,
          vaultAppName: vaultRole,
          port: vaultPort,
          region: scopedCredentialsRegion,
          awsRequestUrl: getAwsRequestUrl(),
        });
      } catch (vaultConstructorError) {
        debug('vault:VaultAwsAuth:constructor')(vaultConstructorError);
        throw vaultConstructorError;
      }

      try {
        const awsAuthResponse = await vaultClient.authenticate();
        token = awsAuthResponse.auth.client_token;
      } catch (awsAuthError) {
        debug('vault:VaultAwsAuth:authenticate')(awsAuthError);
        throw new Error('Error while trying to authenticate to vault server.');
      }
    } else {
      // Assume running in container
      // Attempt to read Vault session token. Throw error otherwise.
      try {
        token = await fsReadFile(vaultTokenPath, { encoding: 'ascii' });
      } catch (fsError) {
        throw fsError.message;
      }
    }
  }

  // Create Vault client
  const vaultOptions = {
    apiVersion: 'v1',
    endpoint: `${vaultAddress}:${vaultPort}`,
    token,
  };
  const vault = new Vault(vaultOptions);

  // Attempt to read secret from Vault. Throw error otherwise.
  try {
    secretValues[path] = await vault.read(path);
    return secretValues[path];
  } catch (vaultError) {
    debug('vault:apiRequest')(vaultError);
    throw vaultError.stack;
  }
};
