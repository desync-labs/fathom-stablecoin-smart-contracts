const { ethers } = require("hardhat");

async function latest() {
  const block = await ethers.provider.getBlock("latest")
  return ethers.BigNumber.from(block.timestamp)
}

async function latestBlockNumber() {
  const block = await ethers.provider.getBlock("latest")
  return ethers.BigNumber.from(block.number)
}

async function advanceBlock() {
  await ethers.provider.send("evm_mine", [])
}

async function increase(duration) {
  if (duration.isNegative()) throw Error(`Cannot increase time by a negative amount (${duration})`)

  await ethers.provider.send("evm_increaseTime", [duration.toNumber()])

  await advanceBlock()
}

const duration = {
  seconds: function (val) {
    return val
  },
  minutes: function (val) {
    return val.mul(this.seconds(ethers.BigNumber.from("60")))
  },
  hours: function (val) {
    return val.mul(this.minutes(ethers.BigNumber.from("60")))
  },
  days: function (val) {
    return val.mul(this.hours(ethers.BigNumber.from("24")))
  },
  weeks: function (val) {
    return val.mul(this.days(ethers.BigNumber.from("7")))
  },
  years: function (val) {
    return val.mul(this.days(ethers.BigNumber.from("365")))
  },
}

async function advanceBlockTo(block) {
  let latestBlock = (await latestBlockNumber()).toNumber()

  if (block <= latestBlock) {
    throw new Error("input block exceeds current block")
  }

  while (block > latestBlock) {
    await advanceBlock()
    latestBlock++
  }
}

module.exports = {advanceBlockTo, duration, increase, advanceBlock, latestBlockNumber, latest}
