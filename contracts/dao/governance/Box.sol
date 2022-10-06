// SPDX-License-Identifier: MIT
// Copyright Fathom 2022

pragma solidity ^0.8.0;

import "./access/Ownable.sol";
import "./interfaces/IBox.sol";

contract Box is IBox, Ownable {
    uint256 private _value;

    // Stores a new value in the contract
    function store(uint256 value) public virtual override onlyOwner {
        _value = value;
        emit ValueChanged(value);
    }

    // Reads the last stored value
    function retrieve() public view virtual override returns (uint256) {
        return _value;
    }
}
