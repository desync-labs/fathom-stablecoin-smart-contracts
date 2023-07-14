// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "./IPriceFeed.sol";

interface IPriceOracle {
    function stableCoinReferencePrice() external view returns (uint256);
}
