// components
const TimelockController = artifacts.require('./dao/governance/TimelockController.sol');
const VeMainToken = artifacts.require('./dao/governance/VeMainToken.sol');
const MainTokenGovernor = artifacts.require('./dao/governance/MainTokenGovernor.sol');
 
const VeMainToken_address = VeMainToken.address;
const TimelockController_address = TimelockController.address;


module.exports =  async function(deployer) {

    let promises = [
        deployer.deploy(MainTokenGovernor, VeMainToken_address, TimelockController_address, 
            ["0x4C5F0f90a2D4b518aFba11E22AC9b8F6B031d204", 
            "0xc0Ee98ac1a44B56fbe2669A3B3C006DEB6fDd0f9", 
            "0x01d2D3da7a42F64e7Dc6Ae405F169836556adC86"], 
            "2", 
            { gas: 120000000 }),
    ];

    await Promise.all(promises);
};

