// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity 0.8.17;
pragma experimental ABIEncoderV2;
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";


import "./interfaces/IBookKeeper.sol";
import "./interfaces/IDEXPriceOracle.sol";
import "./interfaces/IERC20.sol";
import "./interfaces/ICollateralPoolConfig.sol";

contract FathomStatsMock is PausableUpgradeable{
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
    //   uint256 stabilityFeeRate; // Collateral-specific, per-second stability fee debtAccumulatedRate or mint interest debtAccumulatedRate [ray]
  struct PoolInfo {
      uint256 collateralLockedInPool;
      uint256 collateralAvailableToWithdraw;
      uint256 FXDBorrowed;
      uint256 FXDAvailableToBorrow;
      uint256 debtRatio; //Pool Specific LTV at the moment
      uint256 liquidationRatio; //Maximum Debt Ratio
      uint256 liquidatorIncentiveBps; // it will give 10500, which is 1.05
  }
  function initialize() external initializer {
  }

  function getFathomInfo() external pure returns (FathomInfo memory) {
      FathomInfo memory fathomInfo;
      fathomInfo.fathomSupplyCap = 10000000;
      fathomInfo.totalValueLocked = 50000000000000000000; // <- can be divided by 10**WAD
      // 50
      // 000000000000000000
      fathomInfo.FXDPriceFromDex = 978000000000000000000000000;
      fathomInfo.liquidationRatio = 1000000000000000000000000000; // Max LTV 100%
                                    // 1330000000000000000000000000
      fathomInfo.closeFactor = 10000; // 100%
      return fathomInfo;
  }
  function getPoolInfo() external pure returns (PoolInfo memory) {
      PoolInfo memory poolInfo;
      poolInfo.collateralLockedInPool = 3 * WAD;
      poolInfo.collateralAvailableToWithdraw = 1 * WAD;
      poolInfo.FXDBorrowed = 2 * WAD;
      poolInfo.debtRatio = 2 * WAD * 1000 / 3 * WAD;
      poolInfo.liquidationRatio = 1000000000000000000000000000;
      poolInfo.liquidatorIncentiveBps = 10500;
      return poolInfo;
      //     uint256 collateralLockedInPool;
      // uint256 collateralAvailableToWithdraw;
      // uint256 FXDBorrowed;
      // uint256 FXDAvailableToBorrow;
      // uint256 debtRatio; //Pool Specific LTV at the moment
      // uint256 liquidationRatio; //Maximum Debt Ratio
      // uint256 liquidatorIncentiveBps; // it will give 10500, which is 1.05
  }
}










