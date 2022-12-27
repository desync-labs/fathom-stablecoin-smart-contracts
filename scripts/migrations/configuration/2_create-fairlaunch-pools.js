const {getAddresses} = require("../../common/addresses");

const Shield = artifacts.require('Shield.sol');

module.exports = async function (deployer) {
    const fairLaunch = await artifacts.initializeInterfaceAt("FairLaunch", "FairLaunch");
    const fathomToken = await artifacts.initializeInterfaceAt("FathomToken", "FathomToken");
    const addresses = getAddresses(deployer.networkId())
    const promises = [
        fairLaunch.addPool(0, addresses.WXDC, true),
        fairLaunch.addPool(1, addresses.USDT, true),
        fairLaunch.addPool(2, addresses.FTHM, true),
    ]

    await Promise.all(promises);

    await fairLaunch.transferOwnership(Shield.address);
    await fathomToken.transferOwnership(fairLaunch.address, { gasLimit: 1000000 });
}