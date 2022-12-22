// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

interface IFathomFairLaunch {
    function deposit(address, uint256, uint256) external;

    function withdraw(address, uint256, uint256) external;

    function pendingFathom(uint256 _pid, address _user) external view returns (uint256);

    function emergencyWithdraw(uint256) external;

    function owner() external view returns (address);

    function fathom() external view returns (address);

    function userInfo(uint256, address) external view returns (uint256, uint256, uint256, address);

    function poolInfo(uint256) external view returns (address, uint256, uint256, uint256, uint256);
}
