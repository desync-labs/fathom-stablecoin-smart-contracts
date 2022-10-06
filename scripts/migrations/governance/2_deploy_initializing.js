// components
const TimelockController = artifacts.require('./dao/governance/TimelockController.sol');

// interfaces
const ITimelockController = artifacts.require('./dao/governance/ITimelockController.sol');




module.exports = async function(deployer) {
    
    const timelockController = await ITimelockController.at(TimelockController.address);

    await timelockController.initialize(
        1,
        [accounts[0]],
        [accounts[0]],
        { gas: 120000000 }
    );

};
