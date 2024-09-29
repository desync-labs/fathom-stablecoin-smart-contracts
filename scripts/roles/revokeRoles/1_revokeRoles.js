const { getConfig, getRolesInBytes32 } = require("../../common/revoke-role-helper");

module.exports = async function (deployer) {
    const roles = [
        "OWNER_ROLE",
        "GOV_ROLE",
        "PRICE_ORACLE_ROLE",
        "ADAPTER_ROLE",
        "LIQUIDATION_ENGINE_ROLE",
        "STABILITY_FEE_COLLECTOR_ROLE",
        "SHOW_STOPPER_ROLE",
        "POSITION_MANAGER_ROLE",
        "MINTABLE_ROLE",
        "BOOK_KEEPER_ROLE",
        "COLLATERAL_MANAGER_ROLE"
    ];

    try {
        const config = getConfig(deployer.networkId());
        if (!config) {
            throw new Error(`Configuration for network ID ${deployer.networkId()} not found`);
        }

        const accessControlConfig = await artifacts.initializeInterfaceAt("AccessControlConfig", config.AccessControlConfig);
        console.log("Checking roles to Address_To_Revoke_Role");

        const rolesToGrant = roles.filter(role => config[role]);

        for (const role of rolesToGrant) {
            let roleBytes32;
            if (role === "OWNER_ROLE") {
                roleBytes32 = "0x0000000000000000000000000000000000000000000000000000000000000000";
            } else {
                roleBytes32 = getRolesInBytes32(role);
            }
            await accessControlConfig.revokeRole(roleBytes32, config.Address_To_Revoke_Role);
            console.log(`Revoked ${role} to ${config.Address_To_Revoke_Role}`);
        }

        console.log(`Finished`);
    } catch (error) {
        console.error(`Error during revoking role: ${error.message}`);
    }
}