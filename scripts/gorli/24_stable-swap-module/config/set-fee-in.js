const fs = require('fs');

const WeiPerWad = hre.ethers.constants.WeiPerEther

const rawdata = fs.readFileSync('./addresses.json');
let stablecoinAddress = JSON.parse(rawdata);
async function main() {

    const FEE_IN = WeiPerWad.mul(2).div(1000); // [wad = 100%]
  
    const StableSwapModule = await hre.ethers.getContractFactory("StableSwapModule");
    const stableSwapModule = await StableSwapModule.attach(stablecoinAddress.stableSwapModule);
  
    console.log(`>> setFeeIn to ${FEE_IN}`)
    const tx = await stableSwapModule.setFeeIn(FEE_IN)
    await tx.wait()
    console.log(`tx hash: ${tx.hash}`)
    console.log("✅ Done")

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});