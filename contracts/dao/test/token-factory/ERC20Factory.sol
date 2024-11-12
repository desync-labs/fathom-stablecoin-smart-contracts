// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "./interfaces/IERC20Factory.sol";
import "../../tokens/ERC20/ERC20.sol";
import "../../../common/access/AccessControl.sol";

contract Token is ERC20 {
    constructor(string memory _name, string memory _ticker, uint256 _supply) ERC20(_name, _ticker) {
        _mint(msg.sender, _supply);
    }
}

contract ERC20Factory is IERC20Factory, AccessControl {
    bytes32 public constant DEPLOYER_ROLE = keccak256("DEPLOYER_ROLE");

    address[] public tokens;
    uint256 public tokenCount;
    event TokenDeployed(address tokenAddress);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function deployToken(string calldata _name, string calldata _ticker, uint256 _supply) public override onlyRole(DEPLOYER_ROLE) returns (address) {
        Token token = new Token(_name, _ticker, _supply);
        tokens.push(address(token));

        tokenCount += 1;
        token.transfer(msg.sender, _supply);
        emit TokenDeployed(address(token));
        return address(token);
    }
}
