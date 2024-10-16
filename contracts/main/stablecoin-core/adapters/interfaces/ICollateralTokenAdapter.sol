// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "../../../interfaces/IGenericTokenAdapter.sol";

interface ICollateralTokenAdapter is IGenericTokenAdapter {
    function initialize(
        address _bookKeeper,
        bytes32 _collateralPoolId,
        address _collateralToken,
        address _rewardToken,
        address _fairlaunch,
        uint256 _pid,
        address _shield,
        address _timelock,
        uint256 _treasuryFeeBps,
        address _treasuryAccount,
        address _positionManager
    ) external;
}
