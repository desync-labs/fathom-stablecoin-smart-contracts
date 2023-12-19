// SPDX-License-Identifier: AGPL-3.0-or-later

import "../../main/utils/SafeToken.sol";
import "../../main/interfaces/IToken.sol";
pragma solidity 0.8.17;

contract MockedDexRouter {
    using SafeToken for address;
    bool public profitSwitch;
    function swapExactTokensForTokens(
        uint256 _amountIn,
        uint256,
        address[] calldata _path,
        address,
        uint256
    ) external returns (uint256[] memory amounts) {
 
        uint256 amountToSend = _amountIn / (10 ** 12);
        _path[0].safeTransferFrom(msg.sender, address(this), _amountIn);
        if (profitSwitch == true) {
            _path[1].safeTransfer(msg.sender, amountToSend * 110 / 100);
        } else {
            _path[1].safeTransfer(msg.sender, amountToSend);
        }
        amounts = new uint256[](2);
        amounts[0] = _amountIn;
        amounts[1] = amountToSend;
    }

    function deposit(
        address _token,
        uint256 _amount
    ) external {
        _token.safeTransferFrom(msg.sender, address(this), _amount);
    }

    function withdraw(
        address _token
    ) external {
        _token.safeTransfer(msg.sender, _token.balanceOf(address(this)));
    }
    
    function setProfit(
        bool _onOrOff
    ) external {
        profitSwitch = _onOrOff;
    }
}
