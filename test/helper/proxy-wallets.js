const { getProxy } = require("../../common/proxies");

const createProxyWallets = async (signers) => {
  const ProxyFactory = await deployments.get("FathomProxyFactory");
  const proxyFactory = await ethers.getContractAt("FathomProxyFactory", ProxyFactory.address);
  const proxyWalletRegistry = await getProxy(proxyFactory, "ProxyWalletRegistry");

  for (let i = 0; i < signers.length; i++) {
    await Promise.all([proxyWalletRegistry.build(signers[i])]);
  }

  const proxyWallets = await Promise.all(
    signers.map(async (signer) => {
      const proxyWalletAddress = await proxyWalletRegistry.proxies(signer);
      const proxyWallet = await ethers.getContractAt("ProxyWallet", proxyWalletAddress);
      return proxyWallet;
    })
  );

  return { proxyWallets };
};

module.exports = { createProxyWallets };
