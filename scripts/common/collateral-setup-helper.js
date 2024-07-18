const fs = require('fs');
const { formatBytes32String } = require("ethers/lib/utils");
const ZeroAddress = "0x0000000000000000000000000000000000000000"

const rawdata = fs.readFileSync('../../initialCollateralSetUp.json');
const config = JSON.parse(rawdata);

const rawdata2 = fs.readFileSync('../../newCollateralSetup.json');
const config2 = JSON.parse(rawdata2);

function getConfigInitialCollateral(chainId)  {
    let chainConfig = config[chainId];
    return chainConfig;
}

function getConfigAddCollateral(chainId)  {
    let chainConfigNewCollateral = config2[chainId];
    return chainConfigNewCollateral;
}

module.exports = { 
    getConfigInitialCollateral,
    getConfigAddCollateral
}