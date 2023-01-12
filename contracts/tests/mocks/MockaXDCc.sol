// SPDX-License-Identifier: AGPL-3.0-or-later

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

pragma solidity 0.8.17;

contract MockaXDCc is ERC20 {
    
    uint256 public ratio;

    constructor(string memory _name, string memory _symbol) ERC20(_name, _symbol) {
        // ratio = _ratio;
    }

    function setRatio(uint256 _ratio) external {
        ratio = _ratio;
    }

    function mint(address _to, uint256 _amount) external {
        _mint(_to, _amount);
  }
}
