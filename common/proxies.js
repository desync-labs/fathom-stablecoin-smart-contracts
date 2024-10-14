const { ethers } = require("hardhat");
const { formatBytes32String } = ethers.utils;

async function getProxy(proxyFactory, contract) {
  const address = await proxyFactory.proxies(formatBytes32String(contract));
  return await ethers.getContractAt(contract, address);
  // return await artifacts.initializeInterfaceAt(contract, address);
}

async function getProxyById(proxyFactory, contract, proxyId) {
  // proxyFactory is the actual contract
  // contract == "CollateralTokenAdapter"
  const address = await proxyFactory.proxies(proxyId);
  return await ethers.getContractAt(contract, address);
  // return await artifacts.initializeInterfaceAt(contract, address);
}

module.exports = { getProxy, getProxyById };
