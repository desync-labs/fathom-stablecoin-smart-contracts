const fs = require('fs');
const { BigNumber } = require('ethers');

const rawdata = fs.readFileSync('../../../../externalAddresses.json');
let addresses = JSON.parse(rawdata);

const MockedDexRouter = artifacts.require('MockedDexRouter.sol');
const TokenAdapter = artifacts.require('TokenAdapter.sol');
const aXDCcMocked = artifacts.require('MockaXDCc.sol');
const MockedXDCStakingPool = artifacts.require('MockXDCStakingPool.sol');
const FathomToken = artifacts.require('FathomToken.sol');
const ERC20 = artifacts.require('ERC20Mintable.sol');
const ERC20Stable = artifacts.require('ERC20MintableStableSwap.sol')
module.exports =  async function(deployer) {
  const promises = [
      deployer.deploy(ERC20, "US+", "US+", { gas: 3050000 }),
      deployer.deploy(MockedDexRouter, { gas: 3050000 }),
      deployer.deploy(TokenAdapter, { gas: 3050000 }),
      deployer.deploy(FathomToken, 88, 89, { gas: 3050000 }),
      deployer.deploy(aXDCcMocked, "aXDCc", "aXDCc", { gas: 3050000 }),
      deployer.deploy(ERC20Stable,"StableCoin","SFC",{gas: 3050000})
  ];

  await Promise.all(promises);

  await deployer.deploy(MockedXDCStakingPool, aXDCcMocked.address, { gas: 3050000 });

  // set ratio
  const aXDCc = await aXDCcMocked.at(aXDCcMocked.address);
  await aXDCc.setRatio(
    BigNumber.from('878076691684207684'), { gasLimit: 1000000 }
  )

  const chainId = deployer.networkId(ERC20.address);
  addresses[chainId].USD = ERC20.address;
  addresses[chainId].xdcPool = MockedXDCStakingPool.address;
  addresses[chainId].aXDCc = aXDCcMocked.address;

  await deployer.deploy(ERC20, "WXDC", "WXDC", { gas: 3050000 }),
  addresses[chainId].WXDC = ERC20.address;

  fs.writeFileSync('./externalAddresses.json', JSON.stringify(addresses));
};