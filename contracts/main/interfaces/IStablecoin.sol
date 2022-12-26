// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "./IToken.sol";

interface IStablecoin is IToken {
    function mint(address, uint256) external;

    function burn(address, uint256) external;
}
