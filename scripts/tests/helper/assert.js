const { BigNumber } = require("ethers");
const { expect } = require("chai")

function assertAlmostEqual(expected, actual) {
  const expectedBN = BigNumber.from(expected)
  const actualBN = BigNumber.from(actual)
  const diffBN = expectedBN.gt(actualBN) ? expectedBN.sub(actualBN) : actualBN.sub(expectedBN)
  const tolerance = expectedBN.div(BigNumber.from("10000"))
  return expect(diffBN, `${actual} is not almost eqaual to ${expected}`).to.be.lte(tolerance)
}

module.exports = {assertAlmostEqual}