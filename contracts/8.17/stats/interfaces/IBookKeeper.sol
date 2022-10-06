// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;
pragma experimental ABIEncoderV2;

interface IBookKeeper {
  // Information query functions
  function totalDebtCeiling() external view returns (uint256);
}
