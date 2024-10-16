const { getConfig } = require("../common/whitelist-helper");

task("whitelist-fmm", "Whitelist FlashMintModule").setAction(async () => {
  try {
    const config = getConfig(hre.network.config.chainId);
    if (!config) {
      throw new Error(`Configuration for network ID ${hre.network.config.chainId} not found`);
    }

    const flashMintModule = await ethers.getContractAt("FlashMintModule", config.FlashMintModule);
    console.log(`Whitelisting to FlashMintModule: ${flashMintModule.address}`);

    for (let I = 0; I < config.ToBeWhitelisted_FlashMintModule.length; I++) {
      await flashMintModule.addToWhitelist(config.ToBeWhitelisted_FlashMintModule[I]);
      console.log(`Whitelisted: ${config.ToBeWhitelisted_FlashMintModule[I]}`);
    }

    console.log(`Finished`);
  } catch (error) {
    console.error(`Error during whitelisting: ${error.message}`);
  }
});

module.exports = {};
