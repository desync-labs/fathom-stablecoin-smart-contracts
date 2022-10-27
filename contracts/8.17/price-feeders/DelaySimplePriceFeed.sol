// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

contract DelaySimplePriceFeed {

    struct Feed {
        uint128 val;
        bool ok;
    }
    Feed public currentPrice;
    Feed public nextPrice;
    
    uint256 public lastUpdateTSCurrent;
    uint256 public lastUpdateTSNext;
    uint256 public timeDelay;

    constructor(uint256 _timeDelay) {
        timeDelay = _timeDelay;
    }

    event LogSetPrice(address indexed _caller, uint256 _price, bool currentPrice);

    function setPrice(uint128 _nextPrice) external {
        uint256 currentTS = block.timestamp;
        require(_nextPrice > 0, "DelaySimplePriceFeed/NegativePrice");
        if(currentPrice.val == 0 || currentTS > lastUpdateTSCurrent + timeDelay) {
            currentPrice.val = _nextPrice;
            currentPrice.ok = true;
            lastUpdateTSCurrent = currentTS;
            nextPrice.ok = false;
            emit LogSetPrice(msg.sender, currentPrice.val, true);
        } else {
            nextPrice.val = _nextPrice;
            nextPrice.ok = true;
            lastUpdateTSNext = currentTS;
            emit LogSetPrice(msg.sender, nextPrice.val, false);
        }
    }

    function peekPrice() external returns (bytes32, bool) {
        if(block.timestamp < lastUpdateTSCurrent + timeDelay){
            return (bytes32(uint256(currentPrice.val)), currentPrice.ok == true);
        } else {
            if(lastUpdateTSCurrent == lastUpdateTSNext) {
                return (bytes32(uint256(currentPrice.val)), currentPrice.ok == true);
            }
            currentPrice.val = nextPrice.val;
            currentPrice.ok = nextPrice.ok;
            lastUpdateTSCurrent = lastUpdateTSNext;
            return (bytes32(uint256(currentPrice.val)), currentPrice.ok == true);
        }
    }

    // this is just testing price delay.
    // for production, price would be fetched from DEX and saved with 15 min time delay
}