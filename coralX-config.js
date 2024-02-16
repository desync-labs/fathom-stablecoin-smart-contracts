const fs = require("fs");
const path = require("path");

module.exports = {
  networks: {
    development: {
      host: "http://127.0.0.1:8545",
      private_key: fs.readFileSync("./privateKey").toString(),
      gasPrice: '0x3b9aca00',
    },
    apothem: {
      // Please check the status of RPC URL in below link.
      // https://chainlist.org/?search=xdc
      host: "https://erpc.apothem.network/",
      // host: "https://rpc.apothem.network/",
      private_key: fs.readFileSync("./privateKey").toString(),
      gasPrice: '0x3b9aca00',
    },
    mainnet: {
      // Please check the status of RPC URL in below link.
      // https://chainlist.org/?search=xdc
      host: "https://erpc.xdcrpc.com/",
      private_key: fs.readFileSync("./privateKey").toString(),
      gasPrice: '0x3b9aca00',
    },
    fromEnv: {
      host: process.env.ETH_HOST, // export ETH_HOST=...
      private_key: process.env.ETH_PK, // export ETH_PK=...
      gasPrice: process.env.GAS_PRICE, // export GAS_PRICE=...
    },
  },
  compilers: {
    solc: {
      version: "0.8.17",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200,
        },
        evmVersion: 'istanbul',
      },
    },
  },
  scenarios: require('./coralX-scenarios'),
  testsDir: path.join("scripts", "tests"),
}