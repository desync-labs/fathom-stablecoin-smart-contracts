const { BigNumber } = require("ethers");

/**
 * wad: some quantity of tokens, usually as a fixed point integer with 18 decimal places.
 * ray: a fixed point integer, with 27 decimal places.
 * rad: a fixed point integer, with 45 decimal places.
 */

const WeiPerBln = BigNumber.from(`1${"0".repeat(9)}`)
const WeiPerWad = BigNumber.from(`1${"0".repeat(18)}`)
const WeiPerRay = BigNumber.from(`1${"0".repeat(27)}`)
const WeiPerRad = BigNumber.from(`1${"0".repeat(45)}`)

function weiToRay(input) {
  return BigNumber.from(input.mul(WeiPerRay).div(WeiPerWad))
}

function weiToDecimal(input) {
  return Number((input/Math.pow(10, 18)).toFixed(2));
}

function rayToDecimal(input) {
  return Number((input/Math.pow(10, 27)).toFixed(2));
}

module.exports = {WeiPerWad, WeiPerBln, WeiPerRay, WeiPerRad, weiToRay, weiToDecimal, rayToDecimal}
