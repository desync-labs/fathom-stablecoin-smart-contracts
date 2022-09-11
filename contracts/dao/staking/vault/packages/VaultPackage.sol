// SPDX-License-Identifier: AGPL 3.0
// Original Copyright Aurora
// Copyright Fathom 2022

pragma solidity ^0.8.13;
import "../interfaces/IVault.sol";
import "../../../../common/libraries/BytesHelper.sol";
import "../../../../dao/governance/token/ERC20/IERC20.sol";
import "../interfaces/IVaultEvents.sol";

// solhint-disable not-rely-on-time
contract VaultPackage is IVault, IVaultEvents {
    bool private initialized;
    address public admin;

    mapping(address => bool) public override isSupportedToken;

    function initVault() external override {
        require(!initialized, "AdminControlledInit: already initialized");
        admin = msg.sender;
        initialized = true;
    }

    //ADD ADMIN ROLE
    //STAKING CONTRACT SHOULD BE ABLE TO CALL THIS
    function payRewards(
        address _user,
        address _token,
        uint256 _amount
    ) external override {
        require(isSupportedToken[_token], "TOKEN_IS_NOT_SUPPORTED");
        IERC20(_token).transfer(_user, _amount);
    }

    /// @notice adds token as a supproted rewards token by Vault
    /// supported tokens means any future stream token should be
    /// whitelisted here
    /// @param _token stream ERC20 token address
    function addSupportedToken(
        address _token //pausable(1)
    ) external override // onlyRole(TREASURY_MANAGER_ROLE)
    {
        require(!isSupportedToken[_token], "TOKEN_ALREADY_EXISTS");
        isSupportedToken[_token] = true;
        emit TokenAdded(_token, msg.sender, block.timestamp);
    }

    /// @notice removed token as a supproted rewards token by Treasury
    /// @param _token stream ERC20 token address
    function removeSupportedToken(
        address _token // pausable(1)
    ) external override //onlyRole(TREASURY_MANAGER_ROLE)
    {
        require(isSupportedToken[_token], "TOKEN_DOES_NOT_EXIST");
        isSupportedToken[_token] = false;
        emit TokenRemoved(_token, msg.sender, block.timestamp);
    }
}
