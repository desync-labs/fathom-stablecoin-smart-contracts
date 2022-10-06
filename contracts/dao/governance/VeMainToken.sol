// SPDX-License-Identifier: MIT
// Copyright Fathom 2022

pragma solidity ^0.8.4;

import "./token/ERC20/ERC20.sol";
import "./token/ERC20/extensions/ERC20Burnable.sol";
import "./security/Pausable.sol";
import "./access/AccessControl.sol";
import "./token/ERC20/extensions/draft-ERC20Permit.sol";
import "./token/ERC20/extensions/ERC20Votes.sol";
import "./interfaces/IVeMainToken.sol";

contract VeMainToken is IVeMainToken, ERC20, ERC20Burnable, Pausable, AccessControl, ERC20Permit, ERC20Votes {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant WHITELISTER_ROLE = keccak256("MINTER_ROLE");

    // Mapping to keep track of who is allowed to transfer ve tokens
    mapping(address => bool) public isWhiteListed;

    constructor() ERC20("veMainToken", "veMainToken") ERC20Permit("veMainToken") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(WHITELISTER_ROLE, msg.sender);
    }

    /**
     * @dev Whitelist a sender allowing them to transfer ve tokens.
     */
    function addToWhitelist(address _toAdd) public override onlyRole(WHITELISTER_ROLE) {
        isWhiteListed[_toAdd] = true;
        emit MemberAddedToWhitelist(_toAdd);
    }

    /**
     * @dev Remove ability of a whitelisted sender to transfer ve tokens.
     */
    function removeFromWhitelist(address _toRemove) public override onlyRole(WHITELISTER_ROLE) {
        isWhiteListed[_toRemove] = false;
        emit MemberRemovedFromWhitelist(_toRemove);
    }

    function pause() public override onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() public override onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function mint(address to, uint256 amount) public override onlyRole(MINTER_ROLE) {
        _mint(to, amount);
        _delegate(to, to);
    }

    //MaxJi: This thing I have added:
    function burn(address account, uint256 amount) public override onlyRole(MINTER_ROLE) {
        _burn(account, amount);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override whenNotPaused {
        require(isWhiteListed[msg.sender], "VeMainToken: is intransferable unless the sender is whitelisted");
        super._beforeTokenTransfer(from, to, amount);
    }

    // The following functions are overrides required by Solidity.

    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override(ERC20, ERC20Votes) {
        super._afterTokenTransfer(from, to, amount);
    }

    function _mint(address to, uint256 amount) internal override(ERC20, ERC20Votes) {
        super._mint(to, amount);
    }

    function _burn(address account, uint256 amount) internal override(ERC20, ERC20Votes) {
        super._burn(account, amount);
    }
}
