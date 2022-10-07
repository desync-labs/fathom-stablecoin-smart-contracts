const fs = require("fs");
const path = require("path");
require("dotenv").config();

module.exports = {
  networks: {
    development: {
      host: "http://127.0.0.1:8545",
      private_key: fs.readFileSync("./privateKey").toString(),
      gasPrice: '0x3b9aca00',
    },
    mainnet: {
      host: "https://mainnet.infura.io/v3/99c6910d87a34c688c79342177d37bbe",
      private_key: fs.readFileSync("./privateKey").toString(),
      gasPrice: '0x3b9aca00',
    },
    gorli: {
      host: "https://goerli.infura.io/v3/d85fb151be214d8eaee85c855d9d3dab",
      private_key: fs.readFileSync("./privateKey").toString(),
      gasPrice: '0x3b9aca00',
    },
    kovan: {
      host: "https://kovan.infura.io/v3/99c6910d87a34c688c79342177d37bbe",
      private_key: fs.readFileSync("./privateKey").toString(),
      gasPrice: '0x3b9aca00',
    },
    apothem: {
      host: "https://rpc.apothem.network",
      // private_key: fs.readFileSync("./privateKey").toString(),
      private_key: process.env.GORLI_DEPLOYER,
      gasPrice: '0x3b9aca00',
    },
    // fromEnv: {
      // host: process.env.ETH_HOST, // export ETH_HOST=...
      // private_key: process.env.ETH_PK, // export ETH_PK=...
      // gasPrice: process.env.GAS_PRICE, // export GAS_PRICE=...
    // },
  },
  compilers: {
    solc: {
      version: "0.8.17",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200,
        },
        // evmVersion: 'constantinople',
      },
    },
  },
  scenarios: require('./coralX-scenarios'),
  testsDir: path.join("scripts", "tests"),
}