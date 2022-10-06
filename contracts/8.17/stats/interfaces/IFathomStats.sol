// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;
pragma experimental ABIEncoderV2;

interface IFathomStats {
  // Information query functions
  function getWXDCPrice() external view returns (uint256);
  function getUSDTPrice() external view returns (uint256);
}
