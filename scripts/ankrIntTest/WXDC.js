const WXDC = artifacts.require('./tests/mocks/WXDC.sol');

module.exports =  async function(deployer) {

  console.log(">> Deploying an WXDC contract")
  let promises = [
      deployer.deploy(WXDC, { gas: 4050000 }),
  ];
  await Promise.all(promises);

  const deployed = artifacts.require('./tests/mocks/WXDC.sol');

  console.log("WXDC address is : " + deployed.address);
};