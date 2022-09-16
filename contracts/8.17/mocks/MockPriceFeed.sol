// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity 0.8.17;

import "../interfaces/IPriceFeed.sol";

contract MockPriceFeed is IPriceFeed {
  function readPrice() external view override returns (bytes32) {
    return 0;
  }

  function peekPrice() external view override returns (bytes32, bool) {
    return (0, true);
  }
}
