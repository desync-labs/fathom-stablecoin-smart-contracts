const fs = require('fs');

const rawdata = fs.readFileSync('../../../../addresses.json');

let stablecoinAddress = JSON.parse(rawdata);

const FathomToken = artifacts.require('./8.17/apis/fathom/FathomToken.sol');

module.exports = async function(deployer) {
    console.log(">> transfering fathom token's ownership to fairLaunch");
    const fathomToken = await FathomToken.at(stablecoinAddress.fathomToken);
    await fathomToken.transferOwnership(stablecoinAddress.fairLaunch, { gasLimit: 1000000 });
};