const { parseEther } = require("ethers/lib/utils");

const Shield = artifacts.require('./fair-launch/Shield.sol');
const FairLaunch = artifacts.require('./fair-launch/FairLaunch.sol');
const FathomToken = artifacts.require('./tests/FathomToken.sol');

const deployerAddress = "0x4C5F0f90a2D4b518aFba11E22AC9b8F6B031d204";

module.exports = async function (deployer) {
    await deployer.deploy(FairLaunch, FathomToken.address, deployerAddress, parseEther("100"), 0, 0, 0, { gas: 4050000 }),
    await deployer.deploy(Shield, deployerAddress, FairLaunch.address, { gas: 4050000 })
}