// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

interface IProxyWallet {
    function execute(bytes memory _data) external payable returns (bytes memory _response);
}
