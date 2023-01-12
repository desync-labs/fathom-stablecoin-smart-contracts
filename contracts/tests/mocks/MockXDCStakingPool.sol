// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity 0.8.17;

interface IaXDCc {
    function ratio() external view returns (uint256);
    function mint(address _to, uint256 _amount) external;
}

contract MockXDCStakingPool {
    address public aXDCc;
    uint256 constant WAD = 10**18;
    constructor(address _aXDCc){
        aXDCc = _aXDCc;
    }
  function stakeCerts() external payable {
      uint256 ratio = IaXDCc(aXDCc).ratio();
      uint256 amount = (msg.value * ratio / WAD);
      IaXDCc(aXDCc).mint(msg.sender, amount);
  }

}
