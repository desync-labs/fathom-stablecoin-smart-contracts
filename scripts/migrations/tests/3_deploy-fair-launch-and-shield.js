const { parseEther } = require("ethers/lib/utils");

const Shield = artifacts.require('./8.17/apis/fathom/Shield.sol');
const FairLaunch = artifacts.require('./8.17/apis/fathom/FairLaunch.sol');
const FathomToken = artifacts.require('./8.17/apis/fathom/FathomToken.sol');

const deployerAddress = "0x4C5F0f90a2D4b518aFba11E22AC9b8F6B031d204";

module.exports = async function (deployer) {
    await deployer.deploy(FairLaunch, FathomToken.address, deployerAddress, parseEther("100"), 0, 0, 0, { gas: 4050000 }),
    await deployer.deploy(Shield, deployerAddress, FairLaunch.address, { gas: 4050000 })
}