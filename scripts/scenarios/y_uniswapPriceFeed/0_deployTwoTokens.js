const hre = require("hardhat");
require("dotenv").config();
const fs = require('fs');

const { parseEther, formatBytes32String, parseUnits } = require("ethers/lib/utils");
const { BigNumber } = require("ethers");

const WeiPerWad = hre.ethers.constants.WeiPerEther
const WeiPerBln = BigNumber.from(`1${"0".repeat(9)}`)
const WeiPerRay = BigNumber.from(`1${"0".repeat(27)}`)
const WeiPerRad = BigNumber.from(`1${"0".repeat(45)}`)

const FATHOM_PER_BLOCK = parseEther("100")
const COLLATERAL_POOL_ID = formatBytes32String("WXDC")
const CLOSE_FACTOR_BPS = BigNumber.from(5000)
const LIQUIDATOR_INCENTIVE_BPS = BigNumber.from(10500)
const TREASURY_FEE_BPS = BigNumber.from(5000)
const BPS = BigNumber.from(10000)

const privateKey1 = process.env.PRIVATE_KEY1;
const privateKey2 = process.env.PRIVATE_KEY2;
const privateKey3 = process.env.PRIVATE_KEY3;
const privateKey4 = process.env.PRIVATE_KEY4;

const uniswapFActory = process.env.UNISWAP_FACTORY;

const url = "http://localhost:8545";
let provider = new hre.ethers.providers.JsonRpcProvider(url);
const walletDeployer = new hre.ethers.Wallet(privateKey1,provider);
const walletAlice = new hre.ethers.Wallet(privateKey2,provider);
const walletBob = new hre.ethers.Wallet(privateKey3,provider);
const walletDev = new hre.ethers.Wallet(privateKey4,provider);

// Contract addresses
const AddressZero = "0x0000000000000000000000000000000000000000";
// the first address from ganache
const DeployerAddress = walletDeployer.address;
// The second address from ganache
const AliceAddress = walletAlice.address;
// The third address from ganache
const BobAddress = walletBob.address;
// The fourth address from ganache
const DevAddress = walletDev.address;



async function main() {
    const [signer] = await ethers.getSigners();
    // Deploy WXDC
    var WXDC = await createBEP20Token("WXDC");
    await WXDC.mint(signer.address, parseEther("1000000"));
    
    // Deploy mocked USDT
    const USDT = await createBEP20Token("USDT");
    await USDT.mint(signer.address, parseEther("1000000"))

    let addresses = { 
        WXDC: WXDC.address,
        USDT: USDT.address
    };
    
    let data = JSON.stringify(addresses);
    fs.writeFileSync('./scripts/y_uniswapPriceFeed/cupcakes/0_deployTwoTokens.json', data);
}

async function createBEP20Token(name){
    const BEP20 = await hre.ethers.getContractFactory("BEP20");
    const token = await BEP20.deploy(name, name);
    await token.deployed();
    console.log(`${name} deployed to : ${token.address}`);
    return token;
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
