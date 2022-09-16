// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";

import "../interfaces/IFathomOracle.sol";

contract DexPriceOracle is Initializable, IFathomOracle {
  using SafeMathUpgradeable for uint256;
  address public dexFactory;

  function initialize(address _dexFactory) external initializer {
    dexFactory = _dexFactory;
  }

  /// @dev Return the wad price of token0/token1, multiplied by 1e18
  /// NOTE: (if you have 1 token0 how much you can sell it for token1)
  function getPrice(address token0, address token1) external view override returns (uint256, uint256) {
    if (token0 == token1) return (1e18, uint64(block.timestamp));

    //2022 sep 12 mon
    ////make a fathom swap lib with sol v 0.8.17
    // (uint256 r0, uint256 r1) = PancakeLibraryV2.getReserves(dexFactory, token0, token1);
    // uint256 price = r0.mul(1e18).div(r1);

    //2022 sep 12 mon 11:53 am
    //making a dummy return value
    uint256 price = 1;
    return (price, uint64(block.timestamp));
  }
}
