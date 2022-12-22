const MockedDexRouter = artifacts.require('MockedDexRouter.sol');
const TokenAdapter = artifacts.require('TokenAdapter.sol');

module.exports =  async function(deployer) {
  const promises = [
      deployer.deploy(MockedDexRouter, { gas: 3050000 }),
      deployer.deploy(TokenAdapter, { gas: 3050000 }),
      deployer.deploy(TokenAdapter, { gas: 3050000 }),
  ];

  await Promise.all(promises);
};