// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.17;

interface IVault {
    function initVault(address _admin, address[] calldata supportedTokens) external;

    function deposit(address _token, uint256 _amount) external;

    function addRewardsOperator(address _rewardsOperator) external;

    function addSupportedToken(address _token) external;

    function removeSupportedToken(address _token) external;

    function payRewards(address _user, address _token, uint256 _deposit) external;

    function migrate(address vaultPackageMigrateTo) external;

    function withdrawExtraSupportedTokens(address _withdrawTo) external;

    function withdrawExtraUnsupportedToken(address _token, address _withdrawTo) external;

    function isSupportedToken(address token) external view returns (bool);

    function migrated() external view returns (bool);
}
