const { getConfig } = require("../common/transfer-admin-helper");

task("transfer-proxy-admin-ownership", "Transfer Porxy Admin Ownership").setAction(async () => {
  try {
    const config = getConfig(hre.network.config.chainId);
    if (!config) {
      throw new Error(`Configuration for network ID ${hre.network.config.chainId} not found`);
    }

    const fathomProxyAdmin = await ethers.getContractAt("IOwnable", config.FathomProxyAdmin);

    // Grant the OWNER_ROLE
    await fathomProxyAdmin.transferOwnership(config.Address_To_Give_Ownership);

    console.log(`Transfered ProxyAdmin ownership to ${config.Address_To_Give_Ownership}`);

    console.log(`Finished`);
  } catch (error) {
    console.error(`Error during ProxyAdmin ownership switch : ${error.message}`);
  }
});

module.exports = {};
