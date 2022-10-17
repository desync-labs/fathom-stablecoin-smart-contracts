// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity 0.8.17;
pragma experimental ABIEncoderV2;
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";


import "./interfaces/IBookKeeper.sol";
import "./interfaces/IDEXPriceOracle.sol";
import "./interfaces/IERC20.sol";
import "./interfaces/ICollateralPoolConfig.sol";

contract FathomStats is PausableUpgradeable{
  // --- Math ---
  uint256 constant WAD = 10**18;
  uint256 constant RAY = 10**27;
  uint256 constant RAD = 10**45;

  // --- Data ---
  address public BookKeeper;
  address public FairLaunch;
  address public WXDC;
  address public USDT;
  address public FXD;
  address public FTHM;
  address public DEXPriceOracle;
  bytes32 public CollateralPoolId;
  address public CollateralPoolConfig;
  // --- Structs ---
  struct FathomInfo {
      uint256 fathomSupplyCap; // not in WAD. Plain balance that usr usually think
      uint256 totalValueLocked; //WAD but in dollar
      uint256 FXDPriceFromDex; //WAD but in dollar
      uint256 liquidationRatio; //RAY <-reverse of LTV
      uint256 closeFactor;
  }

  struct PoolInfo {
      uint256 collateralLockedInPool;
      uint256 collateralAvailableToWithdraw;
      uint256 FXDBorrowed;
      uint256 FXDAvailableToBorrow;
      uint256 debtRatio; //Pool Specific LTV at the moment
      uint256 liquidationRatio; //Maximum Debt Ratio
      uint256 liquidatorIncentiveBps; // it will give 10500, which is 1.05
  }
    //   uint256 stabilityFeeRate; // Collateral-specific, per-second stability fee debtAccumulatedRate or mint interest debtAccumulatedRate [ray]

//needs to expend 
  struct PositionInfo {
      uint256 collatralAmount;
      uint256 debtShare; // how much FXD borrowed
      uint256 positionLTV;
  }

  function initialize(address bookKeeper, address fairLaunch, address wxdc, address usdt, address fxd, address dEXPriceOracle, bytes32 collateralPoolId, address collateralPoolConfig, address fthm) external initializer {
      BookKeeper = bookKeeper;
      FairLaunch = fairLaunch;
      WXDC = wxdc;
      USDT = usdt;
      FXD = fxd;
      DEXPriceOracle = dEXPriceOracle;
      CollateralPoolId = collateralPoolId;
      CollateralPoolConfig = collateralPoolConfig;
      FTHM = fthm;
  }

  function getFathomInfo() external view returns (FathomInfo memory) {
      FathomInfo memory fathomInfo;
      fathomInfo.fathomSupplyCap = IBookKeeper(BookKeeper).totalDebtCeiling() / RAD;
      uint256 WXDCLocked = IERC20(WXDC).balanceOf(FairLaunch);
      (uint256 WXDCPrice, ) = IDEXPriceOracle(DEXPriceOracle).getPrice(USDT, WXDC);
      uint256 USDTLocked = IERC20(USDT).balanceOf(FairLaunch);
      fathomInfo.totalValueLocked = WXDCLocked * WXDCPrice / WAD + USDTLocked;
                                    //WAD          WAD      WAD    WAD
      (uint256 FXDPrice, ) = IDEXPriceOracle(DEXPriceOracle).getPrice(USDT, FXD);
    //   uint256 FXDPrice = 987000000000000000;

      fathomInfo.FXDPriceFromDex = FXDPrice;
      fathomInfo.liquidationRatio =  ICollateralPoolConfig(CollateralPoolConfig).getLiquidationRatio(CollateralPoolId);
      fathomInfo.closeFactor = ICollateralPoolConfig(CollateralPoolConfig).getCloseFactorBps(CollateralPoolId);
      return fathomInfo;
          //   fathomInfo.MaxLTVProtocol =  1 / ICollateralPoolConfig(CollateralPoolConfig).getLiquidationRatio(CollateralPoolId) / RAY * 100;
    //   fathomInfo.stabilityFeeRate = ICollateralPoolConfig(CollateralPoolConfig).getStabilityFeeRate(CollateralPoolId);
  }

  function getWXDCPrice() external view returns (uint256) {
      (uint256 WXDCPrice, ) = IDEXPriceOracle(DEXPriceOracle).getPrice(USDT, WXDC);
      return WXDCPrice;
  }
  function getFTHMPrice() external view returns (uint256) {
      (uint256 FTHMPrice, ) = IDEXPriceOracle(DEXPriceOracle).getPrice(USDT, FTHM);
      return FTHMPrice;
  }
}










