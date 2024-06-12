const { getConfig } = require("../../common/removeFromWL-helper");

module.exports = async function (deployer) {
    try {
        const config = getConfig(deployer.networkId());
        if (!config) {
            throw new Error(`Configuration for network ID ${deployer.networkId()} not found`);
        }

        const collateralTokenAdapter = await artifacts.initializeInterfaceAt("CollateralTokenAdapter", config.CollateralTokenAdapter);
        console.log(`removeFromWhitelist to \: ${collateralTokenAdapter.address}`);

        for (let I = 0; I < config.ToBeRemoved_CollateralTokenAdapter.length; I++) {
            await collateralTokenAdapter.removeFromWhitelist(config.ToBeRemoved_CollateralTokenAdapter[I], { gasLimit: 2000000 });
            console.log(`Removed from WL: ${config.ToBeRemoved_CollateralTokenAdapter[I]}`);
        }

        console.log(`Finished`);
    } catch (error) {
        console.error(`Error during removeFromWL: ${error.message}`);
    }
}