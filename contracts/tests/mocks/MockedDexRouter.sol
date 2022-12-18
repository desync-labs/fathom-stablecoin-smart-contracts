// SPDX-License-Identifier: AGPL-3.0-or-later

import "../../main/utils/SafeToken.sol";
pragma solidity 0.8.17;

contract MockedDexRouter {
    using SafeToken for address;

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts) {
        uint256 amountToSend = path[1].balanceOf(address(this));
        path[0].safeTransferFrom(msg.sender, address(this), amountIn);
        path[1].safeTransfer(msg.sender, amountToSend);
    }
}
