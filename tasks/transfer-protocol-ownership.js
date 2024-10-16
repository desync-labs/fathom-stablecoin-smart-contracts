const { getConfig } = require("../common/transfer-ownership-helper");

task("transfer-protocol-ownership", "Transfer Protocol Ownership").setAction(async () => {
  try {
    const config = getConfig(hre.network.config.chainId);
    if (!config) {
      throw new Error(`Configuration for network ID ${hre.network.config.chainId} not found`);
    }

    const accessControlConfig = await ethers.getContractAt("AccessControlConfig", config.AccessControlConfig);

    // Directly get the role in bytes32
    const ownerRoleBytes32 = "0x0000000000000000000000000000000000000000000000000000000000000000";

    // Grant the OWNER_ROLE
    await accessControlConfig.grantRole(ownerRoleBytes32, config.Address_To_Give_Ownership);
    await accessControlConfig.renounceRole(ownerRoleBytes32, config.Address_To_Renounce_Ownership);
    console.log(`Granted OWNER_ROLE to ${config.Address_To_Give_Ownership}`);

    console.log(`Finished`);
  } catch (error) {
    console.error(`Error during switching OWNER_ROLE : ${error.message}`);
  }
});

module.exports = {};
