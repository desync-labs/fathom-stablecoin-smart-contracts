// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "./TokenTimelock.sol";
import "./interfaces/ITokenTimelockFactory.sol";
import "../../../common/access/AccessControl.sol";

contract TokenTimelockFactory is ITokenTimelockFactory, AccessControl {
    bytes32 public constant DEPLOYER_ROLE = keccak256("DEPLOYER_ROLE");

    address[] public tokenTimelocks;
    address public token;
    uint256 public tokenTimelocksCount;
    event TokenTimelockDeployed(address tokenTimelock);

    constructor(address token_) {
        token = token_;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function deployTokenTimelocks(
        address[] memory beneficiaries,
        uint256[] memory releaseTimes
    ) public override onlyRole(DEPLOYER_ROLE) returns (address[] memory) {
        uint256 length = beneficiaries.length;
        require(length == releaseTimes.length, "Wrong lengths");

        address[] memory result = new address[](length);

        for (uint256 i = 0; i < length; i++) {
            TokenTimelock tokenTimelock = new TokenTimelock(IERC20(token), beneficiaries[i], releaseTimes[i]);
            tokenTimelocks.push(address(tokenTimelock));

            tokenTimelocksCount += 1;
            emit TokenTimelockDeployed(address(tokenTimelock));

            result[i] = address(tokenTimelock);
        }

        return result;
    }
}
