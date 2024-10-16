// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "../interfaces/IStablecoinAdapter.sol";

interface IStableSwapModuleWrapper {
    function depositTokens(uint256 _amount) external;

    function withdrawTokens(uint256 _amount) external;

    function claimFeesRewards() external;

    function withdrawClaimedFees() external;

    function emergencyWithdraw() external;

    function getAmounts(uint256 _amount) external view returns (uint256, uint256);

    function getActualLiquidityAvailablePerUser(address _account) external view returns (uint256, uint256);

    function getClaimableFeesPerUser(address _account) external view returns (uint256, uint256);
}
