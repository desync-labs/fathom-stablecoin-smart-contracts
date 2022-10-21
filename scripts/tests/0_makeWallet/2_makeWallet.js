const fs = require('fs');

const ProxyWalletRegistry = artifacts.require("./8.17/proxy-wallet/ProxyWalletRegistry.sol");

const rawdata = fs.readFileSync('../../../addresses.json');
let stablecoinAddress = JSON.parse(rawdata);
const devAddress = accounts[0];

module.exports =  async function(deployer) {

    const proxyWalletRegistry = await ProxyWalletRegistry.at(stablecoinAddress.proxyWalletRegistry);
    const proxyWalletDev =  await proxyWalletRegistry.proxies(devAddress);

    console.log("proxyWalletDev is " + proxyWalletDev);
    console.log(0x557cb4e4E3eD6fb9Baa57bF008Ad6271A9D40220 == proxyWalletDev);


    async function openPosition(address, proxyWallet, proxyWalletAs, username) {
        // https://github.com/ethers-io/ethers.js/issues/478
        let openLockTokenAndDrawAbi = [
            "function openLockTokenAndDraw(address _manager, address _stabilityFeeCollector, address _tokenAdapter, address _stablecoinAdapter, bytes32 _collateralPoolId, uint256 _collateralAmount, uint256 _stablecoinAmount, bool _transferFrom, bytes calldata _data)"
        ];
        let openLockTokenAndDrawIFace = new ethers.utils.Interface(openLockTokenAndDrawAbi);
        const encodedResult = ethers.utils.defaultAbiCoder.encode(["address"], [address]);
        console.log(encodedResult);
        let openPositionCall = openLockTokenAndDrawIFace.encodeFunctionData("openLockTokenAndDraw", [
            positionManager.address,
            stabilityFeeCollector.address,
            collateralTokenAdapter.address,
            stablecoinAdapter.address,
            COLLATERAL_POOL_ID,
            WeiPerWad,
            WeiPerWad,
            true,
            encodedResult,
        ]);

        const positionId = await proxyWalletAs.execute2(fathomStablecoinProxyActions.address, openPositionCall);
        const positionAddress = await positionManager.positions(positionCounter)
        console.log(`Position Handler's address for positionId ${positionCounter} `+positionAddress)
        const fathomStablecoinBalance = await fathomStablecoin.balanceOf(address)
        console.log(username + " stablecoin balance : " + fathomStablecoinBalance) 
        // console.log(username + " stablecoin balance in the book : " + result);
        const position = await bookKeeper.positions(COLLATERAL_POOL_ID, positionAddress)
        return positionAddress;
    }
}