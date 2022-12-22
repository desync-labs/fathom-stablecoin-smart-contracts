const { BigNumber, ethers } = require("ethers");

const pools = require("../../common/collateral");

const { getProxy } = require("../../common/proxies");

const Shield = artifacts.require('Shield.sol');
const FairLaunch = artifacts.require('FairLaunch.sol');
const FathomToken = artifacts.require('FathomToken.sol');
const ERC20 = artifacts.require('ERC20Mintable.sol');

const treasury = "0x299739f52346940c7c1E8E156dfD51A6eE61A5Da";
const DeployerWallet = "0x4C5F0f90a2D4b518aFba11E22AC9b8F6B031d204";
const AliceWallet = "0xc0Ee98ac1a44B56fbe2669A3B3C006DEB6fDd0f9";
const BobWallet = "0x01d2D3da7a42F64e7Dc6Ae405F169836556adC86";

module.exports = async function (deployer) {
    const usdtAddr = ERC20.address;
    await deployer.deploy(ERC20, "WXDC", "WXDC", { gas: 3050000 });
    const wxdcAddr = ERC20.address;

    const proxyFactory = await artifacts.initializeInterfaceAt("FathomProxyFactory", "FathomProxyFactory");

    const collateralTokenAdapterFactory = await getProxy(proxyFactory, "CollateralTokenAdapterFactory");
    const bookKeeper = await getProxy(proxyFactory, "BookKeeper")
    const positionManager = await getProxy(proxyFactory, "PositionManager");

    const fathomToken = await artifacts.initializeInterfaceAt("FathomToken", "FathomToken");
    const shield = await artifacts.initializeInterfaceAt("Shield", "Shield");
    const fairLaunch = await artifacts.initializeInterfaceAt("FairLaunch", "FairLaunch");

    const WXDC = await artifacts.initializeInterfaceAt("ERC20Mintable", wxdcAddr);
    const USDT = await artifacts.initializeInterfaceAt("ERC20Mintable", usdtAddr);

    await fairLaunch.addPool(1, wxdcAddr, true);
    await fairLaunch.addPool(0, usdtAddr, true);
    await fairLaunch.transferOwnership(Shield.address);

    await collateralTokenAdapterFactory.createAdapter(
        bookKeeper.address,
        pools.WXDC,
        wxdcAddr,             //COLLATERAL_TOKEN_ADDR
        FathomToken.address,  //Reward token addr
        FairLaunch.address,
        0,  // Pool ID
        Shield.address,   //  DeployerWallet as sheild
        DeployerWallet,                 // deployer as TIME_LOCK
        BigNumber.from(1000),                   //TREASURY_FEE_BPS 1000
        treasury,                 // deployer asTREASURY_ACCOUNT
        positionManager.address
        , { gasLimit: 5000000 }
    )

    await collateralTokenAdapterFactory.createAdapter(
        bookKeeper.address,
        pools.USDT_COL,
        usdtAddr,
        FathomToken.address,
        FairLaunch.address,
        1,
        Shield.address,
        DeployerWallet,
        BigNumber.from(1000),
        DeployerWallet,
        positionManager.address
        , { gasLimit: 5000000 }
    )
    await fathomToken.mint(DeployerWallet, ethers.utils.parseEther("150"), { gasLimit: 1000000 })

    await WXDC.mint(AliceWallet, ethers.BigNumber.from("90000000000000000000000000000000"), { gasLimit: 1000000 });
    await WXDC.mint(BobWallet, ethers.BigNumber.from("90000000000000000000000000000000"), { gasLimit: 1000000 })

    await USDT.mint(AliceWallet, ethers.BigNumber.from("90000000000000000000000000000000"), { gasLimit: 1000000 });
    await USDT.mint(BobWallet, ethers.BigNumber.from("90000000000000000000000000000000"), { gasLimit: 1000000 })
  
    await fathomToken.transferOwnership(fairLaunch.address)
    await shield.transferOwnership(DeployerWallet)
}