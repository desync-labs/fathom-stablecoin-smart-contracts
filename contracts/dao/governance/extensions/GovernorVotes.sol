// SPDX-License-Identifier: MIT
// Original Copyright OpenZeppelin Contracts (last updated v4.6.0) (governance/extensions/GovernorVotes.sol)
// Copyright Fathom 2022

pragma solidity 0.8.17;

import "../Governor.sol";
import "../extensions/IVotes.sol";

abstract contract GovernorVotes is Governor {
    IVotes public immutable token;

    constructor(IVotes tokenAddress) {
        if (address(tokenAddress) == address(0)) {
            revert ZeroAddress();
        }
        token = tokenAddress;
    }

    function _getVotes(address account, uint256 blockNumber, bytes memory /*params*/) internal view virtual override returns (uint256) {
        return token.getPastVotes(account, blockNumber);
    }
}
