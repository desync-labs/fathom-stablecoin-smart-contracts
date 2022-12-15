// const MockMyFlashLoan = artifacts.require('./8.17/mocks/MockMyFlashLoan.sol');
const MockedDexRouter = artifacts.require('./8.17/mocks/MockedDexRouter.sol');

const FlashMintModule = artifacts.require('./8.17/flash-mint/FlashMintModule.sol');

module.exports =  async function(deployer) {
  const promises = [
      deployer.deploy(MockedDexRouter, { gas: 3050000 }),
      // deployer.deploy(MockMyFlashLoan, FlashMintModule.address, { gas: 3050000 }),
  ];

  await Promise.all(promises);
};