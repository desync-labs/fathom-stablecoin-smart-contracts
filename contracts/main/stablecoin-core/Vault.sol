// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../interfaces/IVault.sol";

/**
 * @title Vault
 * @notice A contract representing a vault that holds and manages collateral tokens.
 */

contract Vault is IVault {
    using SafeERC20 for IERC20;

    bytes32 public collateralPoolId;
    address public immutable collateralToken;
    address public immutable collateralAdapter;

    event Deposit(uint256 amount);
    event Withdraw(uint256 amount);

    modifier onlyAdapter() {
        require(msg.sender == collateralAdapter, "Vault/caller-not-adapter");
        _;
    }
    /**
     * @notice Vault constructor.
     * @param _collateralPoolId The identifier of the collateral pool associated with the Vault.
     * @param _collateralToken The address of the ERC20 collateral token held in the Vault.
     * @param _collateralAdapter The address of the collateral adapter responsible for interacting with the Vault.
     * @dev Reverts if any of the input parameters are the zero address or bytes32(0).
     */
    constructor(bytes32 _collateralPoolId, address _collateralToken, address _collateralAdapter) {
        require(_collateralPoolId != bytes32(0), "Vault/zero-collateral-pool");
        require(_collateralToken != address(0), "Vault/zero-collateral-token");
        require(_collateralAdapter != address(0), "Vault/zero-collateral-adapter");

        collateralPoolId = _collateralPoolId;
        collateralToken = _collateralToken;
        collateralAdapter = _collateralAdapter;
    }
    /**
     * @notice Deposit collateral tokens into the Vault.
     * @param _amount The amount of collateral tokens to deposit.
     * @dev This function can only be called by the collateral token adapter, which is responsible for depositing collateral.
     * @dev The Vault contract safely transfers the specified amount of collateral tokens from the caller (collateral token adapter)
     *      to itself.
     * @dev Emits a Deposit event upon a successful deposit.
     */
    function deposit(uint256 _amount) external onlyAdapter {
        IERC20(collateralToken).safeTransferFrom(msg.sender, address(this), _amount);
        emit Deposit(_amount);
    }

    /**
     * @notice Withdraw collateral tokens from the Vault.
     * @param _amount The amount of collateral tokens to withdraw.
     * @dev This function can only be called by the collateral token adapter, which is responsible for managing collateral.
     * @dev The Vault contract safely transfers the specified amount of collateral tokens from itself to the caller
     *      (collateral token adapter).
     * @dev Emits a Withdraw event upon a successful withdrawal.
     */
    function withdraw(uint256 _amount) external onlyAdapter {
        _withdraw(_amount);
    }

    function _withdraw(uint256 _amount) internal {
        IERC20(collateralToken).safeTransfer(msg.sender, _amount);
        emit Withdraw(_amount);
    }
}
