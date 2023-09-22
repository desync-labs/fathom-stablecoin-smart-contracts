const { formatBytes32String } = require("ethers/lib/utils");

const USD_STABLE = formatBytes32String("USD-STABLE")
const FTHM = formatBytes32String("FTHM")
const WXDC = formatBytes32String("WXDC")
const XDC = formatBytes32String("XDC")
const GLD = formatBytes32String("GLD")
const USD_COL = formatBytes32String("USD-COL")

module.exports = { XDC, FTHM, WXDC, USD_COL, USD_STABLE, GLD }