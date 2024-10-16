const { ethers } = require("hardhat");
const { BigNumber } = ethers;

async function latest() {
  const block = await ethers.provider.getBlock("latest");
  return BigNumber.from(block.timestamp);
}

async function getBlockTS(blockNumber) {
  const block = await ethers.provider.getBlock(blockNumber);
  return BigNumber.from(block.timestamp);
}

async function latestBlockNumber() {
  const block = await ethers.provider.getBlock("latest");
  return BigNumber.from(block.number);
}

async function advanceBlock() {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "evm_mine",
        params: [],
        id: new Date().getSeconds(),
      },
      async (err, res) => {
        if (err) {
          reject(err);
        }
        return resolve(res);
      }
    );
  });
}

async function increase(integer) {
  // First we increase the time
  await web3.currentProvider.send(
    {
      jsonrpc: "2.0",
      method: "evm_increaseTime",
      params: [Number(integer)],
      id: 0,
    },
    () => {}
  );
  // Then we mine a block to actually get the time change to occurs
  await advanceBlock();
}

const duration = {
  seconds: function (val) {
    return val;
  },
  minutes: function (val) {
    return val.mul(this.seconds(BigNumber.from("60")));
  },
  hours: function (val) {
    return val.mul(this.minutes(BigNumber.from("60")));
  },
  days: function (val) {
    return val.mul(this.hours(BigNumber.from("24")));
  },
  weeks: function (val) {
    return val.mul(this.days(BigNumber.from("7")));
  },
  years: function (val) {
    return val.mul(this.days(BigNumber.from("365")));
  },
};

async function advanceBlockTo(block) {
  let latestBlock = (await latestBlockNumber()).toNumber();

  if (block <= latestBlock) {
    throw new Error("input block exceeds current block");
  }

  while (block > latestBlock) {
    await advanceBlock();
    latestBlock++;
  }
}

module.exports = { advanceBlockTo, duration, increase, advanceBlock, latestBlockNumber, latest, getBlockTS };
