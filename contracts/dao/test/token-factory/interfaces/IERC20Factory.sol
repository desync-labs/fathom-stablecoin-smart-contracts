// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

interface IERC20Factory {
    function deployToken(string calldata _name, string calldata _ticker, uint256 _supply) external returns (address);
}
