// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

interface IFathomProxyWalletOwner {
    function proxyWallet() external view returns (address);
}
