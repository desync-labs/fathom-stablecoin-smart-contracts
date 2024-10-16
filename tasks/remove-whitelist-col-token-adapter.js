const { getConfig } = require("../common/removeFromWL-helper");

task("remove-whitelist-col-token-adapter", "Remove Whitelist CollateralTokenAdapter").setAction(async () => {
  try {
    const config = getConfig(hre.network.config.chainId);
    if (!config) {
      throw new Error(`Configuration for network ID ${hre.network.config.chainId} not found`);
    }

    const collateralTokenAdapter = await ethers.getContractAt("CollateralTokenAdapter", config.CollateralTokenAdapter);
    console.log(`removeFromWhitelist to \: ${collateralTokenAdapter.address}`);

    for (let I = 0; I < config.ToBeRemoved_CollateralTokenAdapter.length; I++) {
      await collateralTokenAdapter.removeFromWhitelist(config.ToBeRemoved_CollateralTokenAdapter[I]);
      console.log(`Removed from WL: ${config.ToBeRemoved_CollateralTokenAdapter[I]}`);
    }

    console.log(`Finished`);
  } catch (error) {
    console.error(`Error during removeFromWL: ${error.message}`);
  }
});

module.exports = {};

module.exports = async function (deployer) {};
