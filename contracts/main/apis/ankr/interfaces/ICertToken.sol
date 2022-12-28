// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity 0.8.17;

interface ICertToken {
  function ratio() external view returns(uint256);
  function decimals() external view returns(uint256);
  function balanceOf(address) external view returns(uint256);
}
