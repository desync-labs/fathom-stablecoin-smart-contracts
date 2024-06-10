const { getConfig } = require("../../common/whitelist-helper");

module.exports = async function (deployer) {
    try {
        const config = getConfig(deployer.networkId());
        if (!config) {
            throw new Error(`Configuration for network ID ${deployer.networkId()} not found`);
        }

        const flashMintModule = await artifacts.initializeInterfaceAt("FlashMintModule", config.FlashMintModule);
        console.log(`Whitelisting to FlashMintModule: ${flashMintModule.address}`);

        for (let I = 0; I < config.ToBeWhitelisted_FlashMintModule.length; I++) {
            await flashMintModule.addToWhitelist(config.ToBeWhitelisted_FlashMintModule[I], { gasLimit: 2000000 });
            console.log(`Whitelisted: ${config.ToBeWhitelisted_FlashMintModule[I]}`);
        }

        console.log(`Finished`);
    } catch (error) {
        console.error(`Error during whitelisting: ${error.message}`);
    }
}