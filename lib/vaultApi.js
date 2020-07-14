const axios = require('axios');

class Vault {
  constructor(args) {
    // configure axios
    axios.defaults.baseURL = `${args.endpoint}/${args.apiVersion}`;
    axios.defaults.headers.common['X-Vault-Token'] = args.token;
    this.axios = axios;
  }

  read(path) {
    /**
     * KV engine v2 returns data in following format data :{data:{},metadata:{}}.
     * KV engine v1 returns data in the following format data:{}
     */
    return this.axios.get(path)
      .then((secret) => secret.data.data.data || secret.data.data); // check v2 then v1
  }
}

module.exports = Vault;
