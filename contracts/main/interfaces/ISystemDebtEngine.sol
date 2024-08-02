// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

interface ISystemDebtEngine {
    function settleSystemBadDebt(uint256 _value) external; // [rad]

    function surplusBuffer() external view returns (uint256); // [rad]

    function withdrawStablecoinSurplus(address _to, uint256 _value) external; // [rad]

    function withdrawCollateralSurplus(
        bytes32 _collateralPoolId,
        address _to,
        uint256 _amount // [wad]
    ) external ;
}
