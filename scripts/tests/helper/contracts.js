const { DeployerAddress } = require("./address");
const { deployMockContract } = require("ethereum-waffle");
const { ethers } = require("ethers");
var path = require('path');

const provider = new ethers.providers.JsonRpcProvider("http://localhost:8545");
function getInstance(name) {
    if (path.extname(name) !== '.sol') name += '.sol';
    return artifacts.require(name);
}

function getContract(contract, from) {
    const signer = provider.getSigner(from);
    const instance = getInstance(contract);
    return new ethers.Contract(instance.address, instance.getAbiFile().abi, signer);
}

function getContractAt(contract, address, from) {
    const signer = provider.getSigner(from);
    const instance = getInstance(contract);
    return new ethers.Contract(address, instance.getAbiFile().abi, signer);
}

async function createMock(contract) {
    const instance = getInstance(contract);
    const signer = provider.getSigner(DeployerAddress);
    return deployMockContract(signer, instance.getAbiFile().abi);
}

async function connectToContractWithAddress(contract, address) {
    const newSigner = provider.getSigner(address);
    return contract.connect(newSigner);
}

module.exports = { getContract, getContractAt, createMock, connectToContractWithAddress }
