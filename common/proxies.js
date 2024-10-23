const { ethers } = require("hardhat");
const { formatBytes32String } = ethers.utils;

async function getProxy(proxyFactory, contract) {
  const address = await proxyFactory.proxies(formatBytes32String(contract));
  return await ethers.getContractAt(contract, address);
}

async function getProxyById(proxyFactory, contract, proxyId) {
  const address = await proxyFactory.proxies(proxyId);
  return await ethers.getContractAt(contract, address);
}

module.exports = { getProxy, getProxyById };
