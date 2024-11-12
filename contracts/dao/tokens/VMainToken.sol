// SPDX-License-Identifier: MIT
// Copyright Fathom 2022

pragma solidity 0.8.17;

import "../../common/security/Pausable.sol";
import "../../common/access/AccessControl.sol";
import "./ERC20/extensions/ERC20Votes.sol";
import "./IVMainToken.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

contract VMainToken is IVMainToken, Pausable, AccessControl, Initializable, ERC20Votes {
    // Mapping to keep track of who is allowed to transfer voting tokens
    mapping(address => bool) public isAllowListed;

    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant ALLOWLISTER_ROLE = keccak256("ALLOWLISTER_ROLE");

    error AdminShouldBeDifferentThanMsgSender();
    error VMainTokenIsIntransferableUnlessTheSenderIsAllowlisted();

    constructor(string memory name_, string memory symbol_) ERC20Votes(name_, symbol_) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function initToken(address _admin, address _minter) external override initializer onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_admin == msg.sender) revert AdminShouldBeDifferentThanMsgSender();
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(PAUSER_ROLE, _admin);
        _grantRole(MINTER_ROLE, _minter);
        _grantRole(ALLOWLISTER_ROLE, _admin);

        _revokeRole(DEFAULT_ADMIN_ROLE, msg.sender);

        isAllowListed[_minter] = true;
        emit MemberAddedToAllowlist(_minter);
    }

    function grantMinterRole(address _minter) external override onlyRole(getRoleAdmin(MINTER_ROLE)) {
        _grantRole(MINTER_ROLE, _minter);
        _addToAllowlist(_minter);
    }

    function revokeMinterRole(address _minter) external override onlyRole(getRoleAdmin(MINTER_ROLE)) {
        _revokeRole(MINTER_ROLE, _minter);
        _removeFromAllowlist(_minter);
    }

    function pause() external override onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external override onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function mint(address to, uint256 amount) external override onlyRole(MINTER_ROLE) {
        _mint(to, amount);
        _delegate(to, to);
    }

    function burn(address account, uint256 amount) external override onlyRole(MINTER_ROLE) {
        _burn(account, amount);
    }

    function _addToAllowlist(address _toAdd) internal {
        isAllowListed[_toAdd] = true;
        emit MemberAddedToAllowlist(_toAdd);
    }

    function _removeFromAllowlist(address _toRemove) internal {
        isAllowListed[_toRemove] = false;
        emit MemberRemovedFromAllowlist(_toRemove);
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount) internal override whenNotPaused {
        if (!isAllowListed[msg.sender]) revert VMainTokenIsIntransferableUnlessTheSenderIsAllowlisted();
        super._beforeTokenTransfer(from, to, amount);
    }

    function _afterTokenTransfer(address from, address to, uint256 amount) internal override {
        super._afterTokenTransfer(from, to, amount);
    }
}
