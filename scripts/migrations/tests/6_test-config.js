const { ethers } = require("ethers");

const DeployerWallet = "0x4C5F0f90a2D4b518aFba11E22AC9b8F6B031d204";
const AliceWallet = "0xc0Ee98ac1a44B56fbe2669A3B3C006DEB6fDd0f9";
const BobWallet = "0x01d2D3da7a42F64e7Dc6Ae405F169836556adC86";

module.exports = async function (deployer) {
    const accessControlConfig = await artifacts.initializeInterfaceAt("AccessControlConfig", "AccessControlConfig");
    const WXDC = await artifacts.initializeInterfaceAt("WXDC", "WXDC");
    const USDT = await artifacts.initializeInterfaceAt("USDT", "USDT");
    const fathomToken = await artifacts.initializeInterfaceAt("FathomToken", "FathomToken");
    const fairLaunch = await artifacts.initializeInterfaceAt("FairLaunch", "FairLaunch");
    const shield = await artifacts.initializeInterfaceAt("Shield", "Shield");

    await fathomToken.mint(DeployerWallet, ethers.utils.parseEther("150"), { gasLimit: 1000000 })
    await fathomToken.transferOwnership(fairLaunch.address)

    await accessControlConfig.grantRole(await accessControlConfig.PRICE_ORACLE_ROLE(), DeployerWallet)
    await accessControlConfig.grantRole(await accessControlConfig.MINTABLE_ROLE(), DeployerWallet)

    await WXDC.mint(AliceWallet, ethers.BigNumber.from("90000000000000000000000000000000"), { gasLimit: 1000000 });
    await WXDC.mint(BobWallet, ethers.BigNumber.from("90000000000000000000000000000000"), { gasLimit: 1000000 })

    await USDT.mint(AliceWallet, ethers.BigNumber.from("90000000000000000000000000000000"), { gasLimit: 1000000 });
    await USDT.mint(BobWallet, ethers.BigNumber.from("90000000000000000000000000000000"), { gasLimit: 1000000 })

    await shield.transferOwnership(DeployerWallet)
    await accessControlConfig.grantRole(await accessControlConfig.OWNER_ROLE(), DeployerWallet)
}