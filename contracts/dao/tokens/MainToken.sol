// SPDX-License-Identifier: MIT
// Copyright Fathom 2022

pragma solidity 0.8.17;

import "./ERC20/ERC20.sol";

contract MainToken is ERC20 {
    constructor(string memory name_, string memory symbol_, uint256 totalSupply_, address issuer) ERC20(name_, symbol_) {
        _totalSupply = totalSupply_;
        _balances[issuer] = totalSupply_;

        emit Transfer(address(0), issuer, totalSupply_);
    }
}
