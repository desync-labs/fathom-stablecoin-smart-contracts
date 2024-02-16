// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

interface IFathomCentralizedOracle {
    event LogSetAccessControlConfig(address indexed _caller, address _accessControlConfig);

    function getPrice() external view returns (uint256 price, uint256 lastUpdate);
}
