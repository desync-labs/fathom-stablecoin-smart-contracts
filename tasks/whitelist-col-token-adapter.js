const { getConfig } = require("../common/whitelist-helper");

task("whitelist-col-token-adapter", "Whitelist CollateralTokenAdapter").setAction(async () => {
  try {
    const config = getConfig(hre.network.config.chainId);
    if (!config) {
      throw new Error(`Configuration for network ID ${hre.network.config.chainId} not found`);
    }

    const collateralTokenAdapter = await ethers.getContractAt("CollateralTokenAdapter", config.CollateralTokenAdapter);
    console.log(`Whitelisting to CollateralTokenAdapter: ${collateralTokenAdapter.address}`);

    for (let I = 0; I < config.ToBeWhitelisted_CollateralTokenAdapter.length; I++) {
      await collateralTokenAdapter.addToWhitelist(config.ToBeWhitelisted_CollateralTokenAdapter[I]);
      console.log(`Whitelisted: ${config.ToBeWhitelisted_CollateralTokenAdapter[I]}`);
    }

    console.log(`Finished`);
  } catch (error) {
    console.error(`Error during whitelisting: ${error.message}`);
  }
});

module.exports = {};
