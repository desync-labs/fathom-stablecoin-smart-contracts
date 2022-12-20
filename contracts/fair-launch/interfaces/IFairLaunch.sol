// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

interface IFairLaunch {
    function poolLength() external view returns (uint256);

    function addPool(uint256 _allocPoint, address _stakeToken, bool _withUpdate) external;

    function setPool(uint256 _pid, uint256 _allocPoint, bool _withUpdate) external;

    function pendingFathom(uint256 _pid, address _user) external view returns (uint256);

    function updatePool(uint256 _pid) external;

    function deposit(address _for, uint256 _pid, uint256 _amount) external;

    function withdraw(address _for, uint256 _pid, uint256 _amount) external;

    function withdrawAll(address _for, uint256 _pid) external;

    function harvest(uint256 _pid) external;
}
