# @24g/vault
Simple module for accessing Vault secrets. Includes support for Lambda and containers.

```
npm install --save --registry https://vault.24g.dev @24g/vault
```

```Javascript
const vault = require('@24g/vault');

vault('secret/data/foo')
  .then(console.log)
  .catch(console.log)
```
---

## Options
Method can take an optional options object for advanaced configuration.

* `vaultAddress`: Vault endpoint to use. Defaults to the `VAULT_ADDR` environment variable.
* `vaultTokenPath`: Location of the Vault session token on the filesystem. Defaults to the `VAULT_TOKEN_PATH` environment variable or `~/.vault-token` if not set. This option is only needed when running on a server.
* `vaultRole`: What [Vault role](https://www.vaultproject.io/api/auth/aws/index.html#create-role) to attempt to authenticate to. Defaults to the `VAULT_ROLE` environments variable. This option is only needed when running on Lambda.
* `awsScopedCredentialsRegion`: Which region the [STS signature is scoped to](https://docs.aws.amazon.com/general/latest/gr/sigv4_changes.html). Defaults to the `VAULT_AWS_SCOPED_CREDENTIALS_REGION` environment variable or `us-east-1` if not set. This option is only needed when running on Lambda.


```Javascript
const vault = require('@24g/vault');
const options= {
  vaultAddress:'https://vault.24g.dev',
  vaultRole: 'g-1234-developer-role'
};

vault('secret/data/foo', options)
  .then(console.log)
  .catch(console.log)
```

---

## Differences when running on a server vs Lambda
When running on a server, it is assumed you already have a [Auth Agent](https://www.vaultproject.io/docs/agent/) for your [authorization method](https://www.vaultproject.io/docs/auth/index.html) configured and are logged in (already retrieved a session token). When running on Kubernetes, our [single_server_standard](https://bitbucket.org/24g/24g-architecture/src/master/Kubernetes/helm/scaffold/single_server_standard/) scaffold comes preconfigured with a auth agent sidecar to retrieve and renew a session token. In that circumstance, this modules simply acts as an API wrapper.

The following options or environment variables must be set when running on a server/container.
* `options.vaultAddress` || `VAULT_ADDR`
* `options.vaultTokenPath` || `VAULT_TOKEN_PATH`

When running in Lambda, this module will [authenticate to Vault](https://www.vaultproject.io/docs/auth/aws.html) and then make the necessary API requests to retrieve the desired secret. The secret values are cached for the duration of the function invokation. 

The following opions or environment variables must be set.
* `options.vaultAddress` || `VAULT_ADDR`
* `options.vaultRole` || `VAULT_ROLE`
* `options.ScopedCredentialsRegion` || `VAULT_AWS_SCOPED_CREDENTIALS_REGION`

## Debug
This module uses [debug](https://www.npmjs.com/package/debug) to log advanced information. Set the environment variable `DEBUG` to `vault:*` in order to view verbose logs.

```Bash
DEBUG=vault:* node index.js
vault:vaultAwsAuth:authenticate { errors: [ 'entry for role g-1234-developer-role not found' ] } +0ms
Error: Error while trying to authenticate to vault server.
    at getSecret (/home/briananstett/work/@24g-vault/index.js:86:13)
    at process._tickCallback (internal/process/next_tick.js:68:7)

```