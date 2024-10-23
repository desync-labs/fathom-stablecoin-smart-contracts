async function deploy(getNamedAccounts, deployments, getChainId) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = await getChainId();
  
  await deploy("DexPriceOracle", {
    from: deployer,
    args: [],
    log: true,
  });
  await deploy("DelayFathomOraclePriceFeed", {
    from: deployer,
    args: [],
    log: true,
  });
  await deploy("CollateralTokenAdapter", {
    from: deployer,
    args: [],
    log: true,
  });
  await deploy("SlidingWindowDexOracle", {
    from: deployer,
    args: [],
    log: true,
  });

  if (usePlugin(chainId)) {
    await deploy("CentralizedOraclePriceFeed", {
      from: deployer,
      args: [],
      log: true,
    });
  }
}
module.exports = { deploy };