// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "../interfaces/ICollateralPoolConfig.sol";
import "../interfaces/IAccessControlConfig.sol";

interface IFathomBridge {
    function crossChainTransfer(uint64 _dstChainId, address _to, uint _amount) external payable;
}
