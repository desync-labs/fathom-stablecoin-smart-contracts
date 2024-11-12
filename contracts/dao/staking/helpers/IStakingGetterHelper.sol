// SPDX-License-Identifier: AGPL 3.0
// Copyright Fathom 2022
pragma solidity 0.8.17;

import "../StakingStructs.sol";
import "../interfaces/IStakingGetter.sol";
import "../interfaces/IStakingHandler.sol";
import "../interfaces/IStakingStorage.sol";
import "../../../common/security/IAdminPausable.sol";

interface IStakingGetterHelper {
    function getLockInfo(address account, uint256 lockId) external view returns (LockedBalance memory);

    function getLock(address account, uint256 lockId) external view returns (uint128, uint128, uint64, address, uint256);

    function getUserTotalDeposit(address account) external view returns (uint256);

    function getStreamClaimableAmount(uint256 streamId, address account) external view returns (uint256);

    function getUserTotalVotes(address account) external view returns (uint256);

    function getFeesForEarlyUnlock(uint256 lockId, address account) external view returns (uint256);

    function getLocksLength(address account) external view returns (uint256);

    function getWeight() external view returns (Weight memory);
}
