// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";

import "../../main/interfaces/IBookKeeperFlashBorrower.sol";
import "../../main/interfaces/IStableSwapModule.sol";
import "../../main/interfaces/IStablecoinAdapter.sol";
import "../../main/utils/SafeToken.sol";
import "../../main/apis/interfaces/IFathomSwapRouter.sol";

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
        address, // initiator
        uint256 loanValue, // [rad]
        uint256, // fee
        bytes calldata data
    ) external override returns (bytes32) {
        LocalVars memory vars;
        (vars.router, vars.stableSwapToken, vars.stableSwapModule) = abi.decode(data, (address, address, IStableSwapModule));
        address[] memory path = new address[](2);
        path[0] = stablecoin;
        path[1] = vars.stableSwapToken;

        uint256 loanAmount = loanValue / RAY;

        // 1. Swap AUSD to BUSD at a DEX
        //    vars.stableSwapModule.stablecoinAdapter().bookKeeper().whitelist(address(vars.stableSwapModule.stablecoinAdapter()));
        //  vars.stableSwapModule.stablecoinAdapter().withdraw(address(this), loanAmount, abi.encode(0));
        uint256 balanceBefore = vars.stableSwapToken.myBalance();
        stablecoin.safeApprove(vars.router, type(uint).max);
        IFathomSwapRouter(vars.router).swapExactTokensForTokens(loanAmount, 0, path, address(this), block.timestamp);
        stablecoin.safeApprove(vars.router, 0);
        uint256 balanceAfter = vars.stableSwapToken.myBalance();

        // 2. Swap BUSD to AUSD at StableSwapModule
        //   vars.stableSwapToken.safeApprove(address(vars.stableSwapModule.authTokenAdapter()), type(uint).max);
        vars.stableSwapModule.swapTokenToStablecoin(address(this), balanceAfter.sub(balanceBefore));
        // vars.stableSwapToken.safeApprove(address(vars.stableSwapModule.authTokenAdapter()), 0);

        // 3. Approve AUSD for FlashMintModule
        //  stablecoin.safeApprove(address(vars.stableSwapModule.stablecoinAdapter()), loanAmount.add(fee.div(RAY)));
        //vars.stableSwapModule.stablecoinAdapter().deposit(msg.sender, loanAmount.add(fee.div(RAY)), abi.encode(0));

        return keccak256("BookKeeperFlashBorrower.onBookKeeperFlashLoan");
    }
}
