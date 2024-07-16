const { formatBytes32String } = require("ethers/lib/utils");

const USD_STABLE = formatBytes32String("USD-STABLE")
const FTHM = formatBytes32String("FTHM")
const WNATIVE = formatBytes32String("WNATIVE")
const NATIVE = formatBytes32String("NATIVE")
const GLD = formatBytes32String("GLD")
const USD_COL = formatBytes32String("USD-COL")

module.exports = { NATIVE, FTHM, WNATIVE, USD_COL, USD_STABLE, GLD }