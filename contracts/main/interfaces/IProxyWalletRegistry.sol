// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

interface IProxyWalletRegistry {
    // Getter for the proxies mapping
    function proxies(address) external view returns (address);

    // External function `build`
    function build(address _owner) external returns (address payable);
}
