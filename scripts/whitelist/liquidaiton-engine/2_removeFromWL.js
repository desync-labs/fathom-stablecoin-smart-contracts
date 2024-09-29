const { getConfig } = require("../../common/removeFromWL-helper");

module.exports = async function (deployer) {
    try {
        const config = getConfig(deployer.networkId());
        if (!config) {
            throw new Error(`Configuration for network ID ${deployer.networkId()} not found`);
        }

        const liquidationEngine = await artifacts.initializeInterfaceAt("LiquidationEngine", config.LiquidationEngine);
        console.log(`removeFromWhitelist to \: ${liquidationEngine.address}`);

        for (let I = 0; I < config.ToBeRemoved_LiquidationEngine.length; I++) {
            await liquidationEngine.removeFromWhitelist(config.ToBeRemoved_LiquidationEngine[I], { gasLimit: 2000000 });
            console.log(`Removed from WL: ${config.ToBeRemoved_LiquidationEngine[I]}`);
        }

        console.log(`Finished`);
    } catch (error) {
        console.error(`Error during removeFromWL: ${error.message}`);
    }
}