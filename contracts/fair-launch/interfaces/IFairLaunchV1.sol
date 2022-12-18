// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

interface IFairLaunchV1 {
    // Data structure
    struct UserInfo {
        uint256 amount;
        uint256 rewardDebt;
        uint256 bonusDebt;
        address fundedBy;
    }
    struct PoolInfo {
        address stakeToken;
        uint256 allocPoint;
        uint256 lastRewardBlock;
        uint256 accFathomPerShare;
        uint256 accFathomPerShareTilBonusEnd;
    }

    // Information query functions
    function fathomPerBlock() external view returns (uint256);

    function totalAllocPoint() external view returns (uint256);

    function poolInfo(uint256 pid) external view returns (IFairLaunchV1.PoolInfo memory);

    function userInfo(uint256 pid, address user) external view returns (IFairLaunchV1.UserInfo memory);

    function poolLength() external view returns (uint256);

    // OnlyOwner functions
    function setFathomPerBlock(uint256 _fathomPerBlock) external;

    function setBonus(uint256 _bonusMultiplier, uint256 _bonusEndBlock, uint256 _bonusLockUpBps) external;

    function manualMint(address _to, uint256 _amount) external;

    function addPool(uint256 _allocPoint, address _stakeToken, bool _withUpdate) external;

    function setPool(uint256 _pid, uint256 _allocPoint, bool _withUpdate) external;

    // User's interaction functions
    function pendingFathom(uint256 _pid, address _user) external view returns (uint256);

    function updatePool(uint256 _pid) external;

    function deposit(address _for, uint256 _pid, uint256 _amount) external;

    function withdraw(address _for, uint256 _pid, uint256 _amount) external;

    function withdrawAll(address _for, uint256 _pid) external;

    function harvest(uint256 _pid) external;
}
