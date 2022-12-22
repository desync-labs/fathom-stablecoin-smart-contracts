// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "./IFathomVaultConfig.sol";

interface IFathomVault {
    function config() external view returns (IFathomVaultConfig);

    function totalToken() external view returns (uint256);

    function totalSupply() external view returns (uint256);

    function deposit(uint256 amountToken) external payable;

    function withdraw(uint256 share) external;

    function requestFunds(address targetedToken, uint256 amount) external;

    function token() external view returns (address);

    function approve(address spender, uint256 amount) external returns (bool);
}
