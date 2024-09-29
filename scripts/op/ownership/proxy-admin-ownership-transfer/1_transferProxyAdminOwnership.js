const { getConfig } = require("../../../common/transfer-admin-helper");

module.exports = async function (deployer) {
    try {
        const config = getConfig(deployer.networkId());
        if (!config) {
            throw new Error(`Configuration for network ID ${deployer.networkId()} not found`);
        }

        const fathomProxyAdmin = await artifacts.initializeInterfaceAt("IOwnable", config.FathomProxyAdmin);

        // Grant the OWNER_ROLE
        await fathomProxyAdmin.transferOwnership(config.Address_To_Give_Ownership);

        console.log(`Transfered ProxyAdmin ownership to ${config.Address_To_Give_Ownership}`);

        console.log(`Finished`);
    } catch (error) {
        console.error(`Error during ProxyAdmin ownership switch : ${error.message}`);
    }
}