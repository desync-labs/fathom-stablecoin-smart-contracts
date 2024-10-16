// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "../FlashMintModule.sol";
import "../../interfaces/IBookKeeperFlashBorrower.sol";
import "../../interfaces/IERC3156FlashBorrower.sol";
import "../../utils/SafeToken.sol";

abstract contract FlashLoanReceiverBase is IBookKeeperFlashBorrower, IERC3156FlashBorrower {
    using SafeToken for address;

    FlashMintModule public flash;

    bytes32 public constant CALLBACK_SUCCESS = keccak256("ERC3156FlashBorrower.onFlashLoan");
    bytes32 public constant CALLBACK_SUCCESS_BOOK_KEEPER_STABLE_COIN = keccak256("BookKeeperFlashBorrower.onBookKeeperFlashLoan");

    constructor(address _flash) {
        flash = FlashMintModule(_flash);
    }

    // --- Helper Functions ---
    function approvePayback(uint256 _amount) internal {
        // Lender takes back the stablecoin as per ERC 3156 spec
        address(flash.stablecoin()).safeApprove(address(flash), _amount);
    }

    function payBackBookKeeper(uint256 _amount) internal {
        // Lender takes back the stablecoin as per ERC 3156 spec
        flash.bookKeeper().moveStablecoin(address(this), address(flash), _amount);
    }
}
