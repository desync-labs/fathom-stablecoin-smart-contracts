// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity 0.8.17;

import "../interfaces/IFathomOracle.sol";

contract MockFathomOracle is IFathomOracle {
  function getPrice(address, address) external view override returns (uint256 price, uint256 lastUpdate) {
    return (0, 0);
  }
}
