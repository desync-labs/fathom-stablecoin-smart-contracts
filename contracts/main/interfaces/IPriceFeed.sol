// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

interface IPriceFeed {
    event LogSetPriceLife(address indexed _caller, uint256 _second);

    function peekPrice() external returns (uint256, bool); // [wad]

    function readPrice() external view returns (uint256); // [wad]

    function isPriceOk() external view returns (bool);

    function isPriceFresh() external view returns (bool);

    function poolId() external view returns (bytes32);
}
