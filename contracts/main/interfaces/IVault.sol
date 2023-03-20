// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

interface IVault {
  function deposit(uint256 _amount) external;
  function withdraw(uint256 _amount) external;
}
