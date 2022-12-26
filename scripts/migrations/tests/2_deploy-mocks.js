// const MockMyFlashLoan = artifacts.require('./tests/mocks/MockMyFlashLoan.sol');
const MockedDexRouter = artifacts.require('./tests/mocks/MockedDexRouter.sol');

const FlashMintModule = artifacts.require('./main/flash-mint/FlashMintModule.sol');

module.exports =  async function(deployer) {
  const promises = [
      deployer.deploy(MockedDexRouter, { gas: 3050000 }),
      // deployer.deploy(MockMyFlashLoan, FlashMintModule.address, { gas: 3050000 }),
  ];

  await Promise.all(promises);
};