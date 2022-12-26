// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

interface IPriceFeed {
    function readPrice() external view returns (bytes32); // [wad]

    function peekPrice() external returns (bytes32, bool); // [wad]

    function isPriceOk() external view returns (bool);
}
