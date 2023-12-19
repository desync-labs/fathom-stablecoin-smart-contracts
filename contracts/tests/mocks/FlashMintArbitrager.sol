// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";

import "../../main/interfaces/IERC3156FlashBorrower.sol";
import "../../main/interfaces/IStableSwapModule.sol";
import "../../main/interfaces/IStablecoinAdapter.sol";
import "../../main/utils/SafeToken.sol";
import "../../main/apis/interfaces/IFathomSwapRouter.sol";

contract FlashMintArbitrager is OwnableUpgradeable, IERC3156FlashBorrower {
    using SafeMathUpgradeable for uint256;
    using SafeToken for address;

    function initialize() external initializer {
        OwnableUpgradeable.__Ownable_init();
    }

    function onFlashLoan(address, address _token, uint256 _amount, uint256 _fee, bytes calldata _data) external override returns (bytes32) {
        (address router, address stableSwapToken, address stableSwapModule) = abi.decode(_data, (address, address, address));
        address[] memory path = new address[](2);
        path[0] = _token;
        path[1] = stableSwapToken;

        // 1. Swap FXD to USDT at a DEX
        uint256 balanceBefore = stableSwapToken.myBalance();
        _token.safeApprove(router, type(uint).max);
        IFathomSwapRouter(router).swapExactTokensForTokens(_amount, 0, path, address(this), block.timestamp);
        _token.safeApprove(router, 0);
        uint256 balanceAfter = stableSwapToken.myBalance();

        // 2. Swap USDT to FXD at StableSwapModule
        stableSwapToken.safeApprove(stableSwapModule, type(uint).max);
        IStableSwapModule(stableSwapModule).swapTokenToStablecoin(address(this), balanceAfter.sub(balanceBefore));
        stableSwapToken.safeApprove(stableSwapModule, 0);
        // 3. Approve FXD for FlashMintModule
        _token.safeApprove(msg.sender, _amount.add(_fee));

        return keccak256("ERC3156FlashBorrower.onFlashLoan");
    }
}
