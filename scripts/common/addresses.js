const fs = require('fs');

const Deployer = "0x4C5F0f90a2D4b518aFba11E22AC9b8F6B031d204"
const USDT = "0xEdD71f27F357D8545c3c7B411659367c955aCfd1"
const FTHM = "0x939Dd5c782620C92843689ad3DD7E7d1F4eb97aB"
const WXDC = "0x67632B0F5ef75592a051bbD1ADa8D956EeE6c29d"
const DEXFactory = "0x5cf9FB75278606F23b2521e77A424174d2CAA2c3"

const rawdata = fs.readFileSync('../../externalAddresses.json');
const addresses = JSON.parse(rawdata);

function getAddresses(chainId)  {
    return addresses[chainId]
}

module.exports = { getAddresses, Deployer }