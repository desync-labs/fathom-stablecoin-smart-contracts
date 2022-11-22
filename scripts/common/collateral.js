const { formatBytes32String } = require("ethers/lib/utils");

const USDT = formatBytes32String("USDT")
const FTHM = formatBytes32String("FTHM")
const WXDC = formatBytes32String("WXDC")
const USDT_COL = formatBytes32String("USDT-COL")

module.exports = { USDT, FTHM, WXDC, USDT_COL }