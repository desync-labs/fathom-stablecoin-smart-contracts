// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.13;

interface IVault {
    function initVault() external;

    function addSupportedToken(address _token) external;

    function removeSupportedToken(address _token) external;

    function payRewards(
        address _user,
        address _token,
        uint256 _deposit
    ) external;

    function isSupportedToken(address token) external view returns (bool);
}
