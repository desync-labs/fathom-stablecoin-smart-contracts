async function deploy(getNamedAccounts, deployments) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy("CollateralTokenAdapter", {
    from: deployer,
    args: [],
    log: true,
  });
  await deploy("FathomPriceOracle", {
    from: deployer,
    args: [],
    log: true,
  });
  await deploy("CentralizedOraclePriceFeed", {
    from: deployer,
    args: [],
    log: true,
  });
  await deploy("SimplePriceFeedNewCol", {
    from: deployer,
    args: [],
    log: true,
  });
}
module.exports = { deploy };
