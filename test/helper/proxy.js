const { ethers, upgrades } = require("hardhat");

// const ProxyWalletArtifact = require("../../artifacts/contracts/6.12/proxy-wallet/ProxyWallet.sol/ProxyWallet.json");
const ProxyWalletRegistryArtifact = require("../../artifacts/contracts/8.17/proxy-wallet/ProxyWalletRegistry.sol/ProxyWalletRegistry.json");


const loadProxyWalletFixtureHandler = async () => {
  const signers = await ethers.getSigners()
  const deployer = signers[0]

  const ProxyWalletFactory = (await ethers.getContractFactory("ProxyWalletFactory", deployer))
  const proxyWalletFactory = await ProxyWalletFactory.deploy();
  await proxyWalletFactory.deployed();

  const ProxyWalletRegistry = (await ethers.getContractFactory("ProxyWalletRegistry", deployer))
  const proxyWalletRegistry = (await upgrades.deployProxy(ProxyWalletRegistry, [
    proxyWalletFactory.address
  ]))
  await proxyWalletRegistry.deployed();

  const proxyWallets = await Promise.all(
    signers.map(async (signer) => {
      await proxyWalletRegistry["build(address)"](signer.address)
      // const proxyWalletRegistryAsUser = new hre.ethers.Contract(proxyWalletRegistry.address, ProxyWalletRegistryArtifact.abi, signer);
      // await proxyWalletRegistryAsUser.build(signer.address);

      // proxyWalletRegistry.build(signer.address);
      const proxyWalletAddress = await proxyWalletRegistry.proxies(signer.address)

      const ProxieWallet = await ethers.getContractFactory("ProxyWallet");
      const proxyWallet = ProxieWallet.attach(proxyWalletAddress).connect(signer)

      return proxyWallet
    })
  )

  return { proxyWallets }
}

module.exports = { loadProxyWalletFixtureHandler }
