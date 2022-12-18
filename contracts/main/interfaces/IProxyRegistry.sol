// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

interface IProxyRegistry {
    function proxies(address) external view returns (address);

    function build(address) external returns (address);
}
