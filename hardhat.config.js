require("dotenv").config({ path: __dirname + "/.env" });
require("@nomicfoundation/hardhat-toolbox");
require("hardhat-deploy");
require("./tasks/switch-price-feed");
require("./tasks/whitelist-col-token-adapter");
require("./tasks/remove-whitelist-col-token-adapter");
require("./tasks/whitelist-fmm");
require("./tasks/add-roles");
require("./tasks/revoke-roles");
require("./tasks/transfer-protocol-ownership");
require("./tasks/transfer-proxy-admin-ownership");
require("./tasks/fee-collection");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      accounts: {
        mnemonic: process.env.SEED_PHRASE,
      },
      gasPrice: 1000000000,
    },
    apothem: {
      // Please check the status of RPC URL in below link.
      // https://chainlist.org/?search=native
      url: "https://erpc.apothem.network/",
      // url: "https://rpc.apothem.network/",
      accounts: {
        mnemonic: process.env.SEED_PHRASE,
      },
      gasPrice: 1000000000,
    },
    xdc: {
      // Please check the status of RPC URL in below link.
      // https://chainlist.org/?search=native
      url: "https://erpc.xdcrpc.com",
      accounts: {
        mnemonic: process.env.SEED_PHRASE,
      },
      gasPrice: 1000000000,
    },
  },
  solidity: {
    version: "0.8.17",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "istanbul",
      outputSelection: {
        "*": {
          "*": ["storageLayout"],
        },
      },
    },
  },
  namedAccounts: {
    deployer: 0,
  },
};
