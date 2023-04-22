// SPDX-License-Identifier: AGPL-3.0-or-later

import "../../main/utils/SafeToken.sol";
pragma solidity 0.8.17;

contract MockedDexRouter {
    using SafeToken for address;

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256,
        address[] calldata path,
        address,
        uint256
    ) external returns (uint256[] memory amounts) {
        uint256 amountToSend = path[1].balanceOf(address(this));
        path[0].safeTransferFrom(msg.sender, address(this), amountIn);
        path[1].safeTransfer(msg.sender, amountToSend);
        amounts = new uint256[](2);
        amounts[0] = amountIn;
        amounts[1] = amountToSend;
    }
}
