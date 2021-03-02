/**
 * @author Brian Anstett
 */

const fs = require('fs');
const os = require('os');
const Vault = require('./lib/vaultApi');
const VaultAwsAuth = require('./lib/vaultAwsAuth');

// For caching
let secretCache = {};

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
  return `https://sts.${region}.amazonaws.com`;
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
  const path = secretPath || process.env.SECRET_PATH || process.env.KEY_NAME;

  // No secret was passed. No SECRET_PATH || KEY_NAME environment variable set.
  if (!path) return {};

  // Default bypassCache to false
  const bypassCache = options.bypassCache || false;

  // Check if secret exists in cache
  if (Object.keys(secretCache).length > 0 && bypassCache === false) return secretCache;

  // Default to environment variables
  const vaultAddress = options.vaultAddress || process.env.VAULT_ADDR; // Address for the Vault API.
  const vaultTokenPath = options.vaultTokenPath || process.env.VAULT_TOKEN_PATH || `${os.homedir()}/.vault-token`; // Required only for containers. Where on the FS the vault token lives.
  const vaultRole = options.vaultRole || process.env.VAULT_ROLE; // Required only for Lambda. What Vault role to auth to.
  const vaultPort = 443; // Port of the Vault API.
  let token = options.vaultToken || process.env.VAULT_TOKEN; // Use can pass in existing Vault token via options or environment variable.
  const scopedCredentialsRegion = options.awsScopedCredentialsRegion || process.env.VAULT_AWS_SCOPED_CREDENTIALS_REGION || 'us-east-1';
  const region = options.region || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
  let vaultClient;

  // If the user passed in an existing Vault token, you that. Don't go through the process of generating one
  if (token == null) {
    // Determine if being called in Lambda or container.
    if (process.env.AWS_EXECUTION_ENV) {
      // Running in Lambda. Make necessary assumptions.
      if (!vaultRole) throw new Error('Requires either options.vaultRole or VAULT_ROLE environment variable.');
      vaultClient = new VaultAwsAuth({
        host: vaultAddress,
        vaultAppName: vaultRole,
        port: vaultPort,
        region: scopedCredentialsRegion,
        awsRequestUrl: getAwsRequestUrl(region),
      });
      const awsAuthResponse = await vaultClient.authenticate();
      token = awsAuthResponse.auth.client_token;
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
    // Spit the secret by comma. Try to read all secrets. If one secret has a problem, the entire read operation fails.
    // Merge the secrets into one secret. Throw error if there are any collisions.
    const secrets = path.split(',');
    const secretValues = await Promise.all(secrets.map((secret) => vault.read(secret)));
    const seceretKeys = secretValues.map((secretValue) => Object.keys(secretValue)).flat();

    // https://stackoverflow.com/questions/9229645/remove-duplicate-values-from-js-array
    const secretUniqueKeys = [...new Set(seceretKeys)];
    if (seceretKeys.length !== secretUniqueKeys.length) throw new Error("There was a collision while trying to merge your secrets into one. \nMake sure you don't have duplicates between your secrets.");
    const mergedSecret = Object.assign(...secretValues);
    secretCache = mergedSecret;
    return mergedSecret;
  } catch (vaultError) {
    vaultError.message = `Request to Vault server: ${vaultError.message}`;
    throw vaultError.stack;
  }
};
