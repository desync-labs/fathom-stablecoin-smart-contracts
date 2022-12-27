const { formatBytes32String } = require("ethers/lib/utils");

const USDT_STABLE = formatBytes32String("USDT-STABLE")
const FTHM = formatBytes32String("FTHM")
const WXDC = formatBytes32String("WXDC")
const USDT_COL = formatBytes32String("USDT-COL")

module.exports = { FTHM, WXDC, USDT_COL, USDT_STABLE }