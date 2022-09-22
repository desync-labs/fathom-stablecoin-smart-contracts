// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";

import "./lib/FathomSwapLibrary.sol";
import "../interfaces/IFathomDEXPair.sol";

contract CheckPairAddress is Initializable, IFathomDEXPair {
  using SafeMathUpgradeable for uint256;
  address public dexFactory;

  function initialize(address _dexFactory) external initializer {
    dexFactory = _dexFactory;
  }

  /// @dev Return the wad price of token0/token1, multiplied by 1e18
  /// NOTE: (if you have 1 token0 how much you can sell it for token1)
  function getPair(address token0, address token1) external view override returns (address) {
    address pair = FathomSwapLibrary.pairFor(dexFactory, token0, token1);
    return pair;
  }
}
