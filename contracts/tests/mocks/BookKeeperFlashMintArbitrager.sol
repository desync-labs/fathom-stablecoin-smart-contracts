// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { SafeMathUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";

import { IBookKeeperFlashBorrower } from "../../main/interfaces/IBookKeeperFlashBorrower.sol";
import { IStableSwapModule } from "../../main/interfaces/IStableSwapModule.sol";
import { IStablecoinAdapter } from "../../main/interfaces/IStablecoinAdapter.sol";
import { IStablecoinAdapterGetter } from "../../main/interfaces/IStablecoinAdapterGetter.sol";

import { SafeToken } from "../../main/utils/SafeToken.sol";
import { IFathomSwapRouter } from "../../main/apis/interfaces/IFathomSwapRouter.sol";

contract BookKeeperFlashMintArbitrager is OwnableUpgradeable, IBookKeeperFlashBorrower {
    using SafeMathUpgradeable for uint256;
    using SafeToken for address;
    address public stablecoin;

    struct LocalVars {
        address router;
        address stableSwapToken;
        IStableSwapModule stableSwapModule;
    }

    function initialize(address _stablecoin) external initializer {
        OwnableUpgradeable.__Ownable_init();

        stablecoin = _stablecoin;
    }

    uint256 constant RAY = 10 ** 27;

    function onBookKeeperFlashLoan(
        address, //initiator
        uint256 _loanValue, // [rad]
        uint256 fee,
        bytes calldata _data
    ) external override returns (bytes32) {
        LocalVars memory vars;
        (vars.router, vars.stableSwapToken, vars.stableSwapModule) = abi.decode(_data, (address, address, IStableSwapModule));
        address[] memory path = new address[](2);
        path[0] = stablecoin;
        path[1] = vars.stableSwapToken;

        uint256 loanAmount = _loanValue / RAY;

        // 1. Swap FXD to USDT at a DEX
        vars.stableSwapModule.bookKeeper().addToWhitelist(address(IStablecoinAdapterGetter(msg.sender).stablecoinAdapter()));
        //above is actually callling bookKeeper.addToWhiteList(stablecoinAdapterAddress);
        IStablecoinAdapterGetter(msg.sender).stablecoinAdapter().withdraw(address(this), loanAmount, abi.encode(0));

        uint256 balanceBefore = vars.stableSwapToken.myBalance();
        stablecoin.safeApprove(vars.router, type(uint).max);
        IFathomSwapRouter(vars.router).swapExactTokensForTokens(loanAmount, 0, path, address(this), block.timestamp);
        stablecoin.safeApprove(vars.router, 0);
        uint256 balanceAfter = vars.stableSwapToken.myBalance();

        // 2. Swap USDT to FXD at StableSwapModule
        vars.stableSwapToken.safeApprove(address(vars.stableSwapModule), type(uint).max);
        vars.stableSwapModule.swapTokenToStablecoin(address(this), balanceAfter.sub(balanceBefore));
        vars.stableSwapToken.safeApprove(address(vars.stableSwapModule), 0);

        // 3. Approve FXD for FlashMintModule
        stablecoin.safeApprove(address(IStablecoinAdapterGetter(msg.sender).stablecoinAdapter()), loanAmount.add(fee.div(RAY)));
        IStablecoinAdapterGetter(msg.sender).stablecoinAdapter().deposit(msg.sender, loanAmount.add(fee.div(RAY)), abi.encode(0));

        return keccak256("BookKeeperFlashBorrower.onBookKeeperFlashLoan");
    }
}
