// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "../interfaces/IBookKeeper.sol";

contract PositionHandler {
    constructor(address _bookKeeper) {
        IBookKeeper(_bookKeeper).whitelist(msg.sender);
    }
}
