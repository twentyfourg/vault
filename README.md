# @24g/vault
Simple module for accessing Vault secrets. Currently includes support for Lambda and containers.

## Usage

```
npm install --save --registry https://npm.24g.dev @24g/vault
```

```Javascript
const vault = require('@24g/vault');

vault('secret/data/foo')
  .then(console.log)
  .catch(console.log)
```

## Options

* `vaultAddress`: Vault endpoint to use. Defaults to the `VAULT_ADDR` environment variable.
* `vaultTokenPath`: Location of the Vault session token on the filesystem. Defaults to the `VAULT_TOKEN_PATH` environment variable or `~/.vault-token` if not set. This option is only needed when running on a server/container.
* `bypassCache`: Make a new API request for secrets instead of pulling from cache. Defaults to `false`.
* `vaultRole`: What [Vault role](https://www.vaultproject.io/api/auth/aws/index.html#create-role) to attempt to authenticate to. Defaults to the `VAULT_ROLE` environments variable. This option is only needed when running on Lambda.
* `vaultToken`: Existing Vault auth token. Can also be set using the `VAULT_TOKEN` environment variable. If left blank, this package attempts to generate a new Vault auth token for you.
* `awsScopedCredentialsRegion`: Which region the [STS signature is scoped to](https://docs.aws.amazon.com/general/latest/gr/sigv4_changes.html). Defaults to the `VAULT_AWS_SCOPED_CREDENTIALS_REGION` environment variable or `us-east-1` if not set. This option is only needed when running on Lambda.


```Javascript
const vault = require('@24g/vault');
const options= {
  vaultAddress:'https://vault.24g.dev'
};

vault('secret/data/foo', options)
  .then(console.log)
  .catch(console.log)
```

## Multiple secrets
This module supports passing a comma separated list of secrets. This module will retrieve all the secrets in the list and return one objects with all the secrets combined. If one or more secrets in the list fail to be retrieved, an error will be thrown. If there are any collisions during the merge, an error will be thrown.

```
vault('kv/foo/bar,kv/foo/bar1')
  .then(console.log)
  .catch(console.log);

{ foo: 'bar', bar: 'asdf', baz: 'asdf' }
```

## Vault Login for Local Development
Make sure you have the [Vault binaries](https://www.vaultproject.io/downloads.html) installed locally on your machine. Once installed, configure the Vault CLI to use 24G's vault server ([https://vault.24g.dev](https://vault.24g.dev)). This can be down by setting the `VAULT_ADDR` environment variable. (You can use files like `~/.bashrc` to automatically set environment variables on login).

Log into Vault using the `vault login` command.
* `-method`: What auth method to use. Set this to `oidc`.
* `role`: The preconfigure auth method role. Use `google`.

```bash
export VAULT_ADDR=https://vault.24g.dev
vault login -method oidc role=google
```

## Using the SECRET_PATH Environment Variable
This module will default to using the `SECRET_PATH` environment variable as the secret path if no other path is explicitly provided when invoked.

```javascript
process.env.SECRET_PATH = 'secret/data/foo';
vault()
  .then(console.log)
  .catch(console.log)
```

## Word on caching
This module caches the retrieved secrets in memory. This is done to limit the response latency caused by an API call to just the *first* retrieval of the secret. This helps performance but can result in stale secrets depending on your use case. If you wish to bypass the cache and make a fresh API request, use the `bypassCache` option.

```Javascript
await vault('secret/data/foo'); // 300ms latency

await vault('secret/data/foo'); // 4ms latency

await vault('secret/data/foo', {bypassCache: true}); // 300ms latency

```

## Differences when running on a server vs Lambda
When running on a server, it is assumed you already have a [Auth Agent](https://www.vaultproject.io/docs/agent/) for your [authorization method](https://www.vaultproject.io/docs/auth/index.html) configured and are logged in (already retrieved a session token). When running on Kubernetes, our [single_server_standard](https://bitbucket.org/24g/24g-architecture/src/master/Kubernetes/helm/scaffold/single_server_standard/) scaffold comes preconfigured with a auth agent sidecar to retrieve and renew a session token. In that circumstance, this modules simply acts as an API wrapper.

The following options or environment variables must be set when running on a server/container.
* `options.vaultAddress` || `VAULT_ADDR`
* `options.vaultTokenPath` || `VAULT_TOKEN_PATH` || Will default to `~/.vault-token`

```Javascript
const vault = require('@24g/vault');
const options= {
  vaultAddress:'https://vault.24g.dev'
};

vault('secret/data/foo', options)
  .then(console.log)
  .catch(console.log)
```

When running in Lambda, this module will [authenticate to Vault](https://www.vaultproject.io/docs/auth/aws.html) and then make the necessary API requests to retrieve the desired secret. The secret values are cached for the duration of the function invokation. 

The following opions or environment variables must be set when running in a Lambda function.
* `options.vaultAddress` || `VAULT_ADDR`
* `options.vaultRole` || `VAULT_ROLE`
* `options.awsScopedCredentialsRegion` || `VAULT_AWS_SCOPED_CREDENTIALS_REGION` || Will default to `us-east-1`

```Javascript
const vault = require('@24g/vault');
const options= {
  vaultAddress:'https://vault.24g.dev',
  vaultRole: 'g-1234-fooBar-aws-role',
  awsScopedCredentialsRegion: 'us-east-1'
};

vault('secret/data/foo', options)
  .then(console.log)
  .catch(console.log)
```

## References
* [https://vault.24g.dev](https://vault.24g.dev)
* [Official Vault docs](https://www.vaultproject.io/docs/)
* [24G docs on Vault](https://www.notion.so/24g/Vault-931889bba0314daf9b77218d64a882f1)
