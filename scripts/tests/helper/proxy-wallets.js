const { getProxy } = require("../../common/proxies");

const createProxyWallets = async (signers) => {
  const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", "FathomProxyFactory");
  const proxyWalletRegistry = await getProxy(proxyFactory, "ProxyWalletRegistry");

  for (let i = 0; i < signers.length; i++) {
    await Promise.all([proxyWalletRegistry.build(signers[i], { gasLimit: 2000000 })])
  }

  const proxyWallets = await Promise.all(
    signers.map(async (signer) => {
      const proxyWalletAddress = await proxyWalletRegistry.proxies(signer)
      const proxyWallet = await artifacts.initializeInterfaceAt("ProxyWallet", proxyWalletAddress);
      return proxyWallet
    })
  )

  return { proxyWallets }
}

module.exports = { createProxyWallets }
