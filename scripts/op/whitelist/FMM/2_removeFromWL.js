const { getConfig } = require("../../../common/removeFromWL-helper");

module.exports = async function (deployer) {
    try {
        const config = getConfig(deployer.networkId());
        if (!config) {
            throw new Error(`Configuration for network ID ${deployer.networkId()} not found`);
        }

        const flashMintModule = await artifacts.initializeInterfaceAt("FlashMintModule", config.FlashMintModule);
        console.log(`removeFromWhitelist to \: ${flashMintModule.address}`);

        for (let I = 0; I < config.ToBeRemoved_FlashMintModule.length; I++) {
            await flashMintModule.removeFromWhitelist(config.ToBeRemoved_FlashMintModule[I], { gasLimit: 2000000 });
            console.log(`Removed from WL: ${config.ToBeRemoved_FlashMintModule[I]}`);
        }

        console.log(`Finished`);
    } catch (error) {
        console.error(`Error during removeFromWL: ${error.message}`);
    }
}