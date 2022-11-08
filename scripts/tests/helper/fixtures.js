const { DeployerAddress } = require("./address");
const { createFixtureLoader } = require("ethereum-waffle");
const { ethers } = require("ethers");

const provider = new ethers.providers.JsonRpcProvider("http://localhost:8545");

const loadFixture = createFixtureLoader(
    [provider.getSigner(DeployerAddress)],
    provider
);

module.exports = { loadFixture }