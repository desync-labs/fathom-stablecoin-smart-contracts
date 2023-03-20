// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../interfaces/IVault.sol";

contract Vault is IVault {
  using SafeERC20 for IERC20;

  bytes32 public collateralPoolId;
  address public collateralToken;
  address public collateralAdapter;

  event Deposit(uint256 amount);
  event Withdraw(uint256 amount);

  constructor(bytes32 _collateralPoolId, address _collateralToken, address _collateralAdapter) {
      collateralPoolId = _collateralPoolId;
      collateralToken = _collateralToken;
      collateralAdapter = _collateralAdapter;
  }

  function deposit(
    uint256 _amount
  ) external {
    require(msg.sender == collateralAdapter, "Vault/caller-not-adapter");
    IERC20(collateralToken).safeTransferFrom(msg.sender, address(this), _amount);
    emit Deposit(_amount);
  }

  function withdraw(
    uint256 _amount
  ) external {
    require(msg.sender == collateralAdapter, "Vault/caller-not-adapter");
    _withdraw(_amount);
  }

  function _withdraw(
    uint256 _amount
  ) internal {
    IERC20(collateralToken).safeTransfer(msg.sender, _amount);
    emit Withdraw(_amount);
  }
}
