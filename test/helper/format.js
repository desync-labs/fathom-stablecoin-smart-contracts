const { ethers } = require("hardhat");

function formatBytes32BigNumber(n) {
  return ethers.utils.hexZeroPad(n.toHexString(), 32)
}

module.exports = {formatBytes32BigNumber}
