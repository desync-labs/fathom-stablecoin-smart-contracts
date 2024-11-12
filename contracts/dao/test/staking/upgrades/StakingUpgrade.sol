// SPDX-License-Identifier: AGPL 3.0
// Original Copyright Aurora
// Copyright Fathom 2022
pragma solidity 0.8.17;

import "../../../staking/packages/StakingHandler.sol";

interface IStakingUpgrade {
    function getLockInfo(address account, uint256 lockId) external view returns (LockedBalance memory);
}

contract StakingUpgrade is StakingHandlers, IStakingUpgrade {
    function getLockInfo(address account, uint256 lockId) public view override returns (LockedBalance memory) {
        require(lockId <= locks[account].length, "out of index");
        require(lockId > 0, "lockId cant be 0");
        return locks[account][lockId - 1];
    }
}
