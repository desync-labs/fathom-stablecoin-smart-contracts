const { getConfig } = require("../../../common/whitelist-helper");

module.exports = async function (deployer) {
    try {
        const config = getConfig(deployer.networkId());
        if (!config) {
            throw new Error(`Configuration for network ID ${deployer.networkId()} not found`);
        }

        const liquidationEngine = await artifacts.initializeInterfaceAt("LiquidationEngine", config.LiquidationEngine);
        console.log(`Whitelisting to LiquidationEngine: ${liquidationEngine.address}`);

        for (let I = 0; I < config.ToBeWhitelisted_LiquidationEngine.length; I++) {
            await liquidationEngine.addToWhitelist(config.ToBeWhitelisted_LiquidationEngine[I], { gasLimit: 2000000 });
            console.log(`Whitelisted: ${config.ToBeWhitelisted_LiquidationEngine[I]}`);
        }

        console.log(`Finished`);
    } catch (error) {
        console.error(`Error during whitelisting: ${error.message}`);
    }
}