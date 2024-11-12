// SPDX-License-Identifier: MIT
// Original Copyright OpenZeppelin Contracts (last updated v4.5.0) (token/ERC20/utils/TokenTimelock.sol)
// Copyright Fathom 2022

pragma solidity 0.8.17;

import "../../../common/SafeERC20.sol";
import "./interfaces/ITokenTimelock.sol";

/**
 * @dev A token holder contract that will allow a beneficiary to extract the
 * tokens after a given release time.
 *
 * Useful for simple vesting schedules like "advisors get all of their tokens
 * after 1 year".
 */
contract TokenTimelock is ITokenTimelock {
    using SafeERC20 for IERC20;

    // ERC20 basic token contract being held
    IERC20 private immutable _token;

    // beneficiary of tokens after they are released
    address private immutable _beneficiary;

    // timestamp when token release is enabled
    uint256 private immutable _releaseTime;

    constructor(IERC20 token_, address beneficiary_, uint256 releaseTime_) {
        // solhint-disable-next-line
        require(releaseTime_ > block.timestamp, "TokenTimelock: release time is before current time");
        _token = token_;
        _beneficiary = beneficiary_;
        _releaseTime = releaseTime_;
    }

    function release() public override {
        // solhint-disable-next-line
        require(block.timestamp >= releaseTime(), "TokenTimelock: current time is before release time");

        uint256 amount = token().balanceOf(address(this));
        require(amount > 0, "TokenTimelock: no tokens to release");

        token().safeTransfer(beneficiary(), amount);
    }

    function token() public view override returns (IERC20) {
        return _token;
    }

    function beneficiary() public view override returns (address) {
        return _beneficiary;
    }

    function releaseTime() public view override returns (uint256) {
        return _releaseTime;
    }
}
