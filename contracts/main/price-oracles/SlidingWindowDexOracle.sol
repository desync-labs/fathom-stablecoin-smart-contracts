// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "./lib/FathomSwapLibrary.sol";
import "../apis/interfaces/IFathomSwapPair.sol";
import "../apis/interfaces/IFathomSwapFactory.sol";
import "../interfaces/IFathomDEXOracle.sol";
import "../interfaces/IToken.sol";

// sliding window oracle that uses observations collected over a window to provide moving price averages in the past
// `windowSize` with a precision of `windowSize / granularity`
contract SlidingWindowDexOracle is Initializable, IFathomDEXOracle {
    struct Observation {
        uint256 timestamp;
        uint256 price0Cumulative;
        uint256 price1Cumulative;
    }

    address public factory;
    // the desired amount of time over which the moving average should be computed, e.g. 24 hours
    uint256 public windowSize;
    // the number of observations stored for each pair, i.e. how many price observations are stored for the window.
    // as granularity increases from 1, more frequent updates are needed, but moving averages become more precise.
    // averages are computed over intervals with sizes in the range:
    //   [windowSize - (windowSize / granularity) * 2, windowSize]
    // e.g. if the window size is 24 hours, and the granularity is 24, the oracle will return the average price for
    //   the period:
    //   [now - [22 hours, 24 hours], now]
    uint8 public granularity;
    // this is redundant with granularity and windowSize, but stored for gas savings & informational purposes.
    uint256 public periodSize;

    // mapping from pair address to a list of price observations of that pair
    mapping(address => Observation[]) public pairObservations;

    uint8 public constant RESOLUTION = 112;

    function initialize(address _factory, uint256 _windowSize, uint8 _granularity) external initializer {
        require(_factory != address(0), "SlidingWindowDexOracle/zero-factory");
        require(_granularity > 1, "SlidingWindowDexOracle/invalid-granularity");
        require((periodSize = _windowSize / _granularity) * _granularity == _windowSize, "SlidingWindowDexOracle/window-not-evenly-divisible");

        factory = _factory;
        windowSize = _windowSize;
        granularity = _granularity;
    }

    // update the cumulative price for the observation at the current timestamp. each observation is updated at most
    // once per epoch period.
    function update(address tokenA, address tokenB) external {
        require(tokenA != tokenB, "SlidingWindowDexOracle/same-tokens");

        address pair = FathomSwapLibrary.pairFor(factory, tokenA, tokenB);

        // populate the array with empty observations (first call only)
        for (uint256 i = pairObservations[pair].length; i < granularity; i++) {
            pairObservations[pair].push();
        }

        // get the observation for the current period
        uint8 observationIndex = observationIndexOf(block.timestamp);
        Observation storage observation = pairObservations[pair][observationIndex];

        // we only want to commit updates once per period (i.e. windowSize / granularity)
        uint256 timeElapsed = block.timestamp - observation.timestamp;
        if (timeElapsed > periodSize) {
            (uint256 price0Cumulative, uint256 price1Cumulative) = currentCumulativePrice(pair);
            observation.timestamp = block.timestamp;
            observation.price0Cumulative = price0Cumulative;
            observation.price1Cumulative = price1Cumulative;
        }
    }

    // range [now - [windowSize, windowSize - periodSize * 2], now]
    // update must have been called for the bucket corresponding to timestamp `now - windowSize`
    function getPrice(address tokenA, address tokenB) external view override returns (uint256 price, uint256 blockTimestampLast) {
        require(tokenA != tokenB, "SlidingWindowDexOracle/same-tokens");

        address pair = FathomSwapLibrary.pairFor(factory, tokenA, tokenB);
        Observation memory firstObservation = getFirstObservationInWindow(pair);

        uint256 timeElapsed = block.timestamp - firstObservation.timestamp;
        require(timeElapsed <= windowSize, "SlidingWindowDexOracle/missing-historical-observation");
        // should never happen.
        require(timeElapsed >= windowSize - periodSize * 2, "SlidingWindowDexOracle/unexpected-time-elapsed");

        (uint256 price0Cumulative, uint256 price1Cumulative) = currentCumulativePrice(pair);
        (address token0, ) = FathomSwapLibrary.sortTokens(tokenA, tokenB);

        uint256 decimalsA = IToken(tokenA).decimals();
        uint256 decimalsB = IToken(tokenB).decimals();
        uint256 rawPrice = tokenA == token0
            ? ((price0Cumulative - firstObservation.price0Cumulative) / timeElapsed)
            : ((price1Cumulative - firstObservation.price1Cumulative) / timeElapsed);

        price = (_toDecimals18(rawPrice * (10 ** decimalsA), decimalsB)) >> RESOLUTION;
        blockTimestampLast = block.timestamp;
    }

    // returns the index of the observation corresponding to the given timestamp
    function observationIndexOf(uint256 timestamp) public view returns (uint8 index) {
        uint256 epochPeriod = timestamp / periodSize;
        return uint8(epochPeriod % granularity);
    }

    // returns the observation from the oldest epoch (at the beginning of the window) relative to the current time
    function getFirstObservationInWindow(address pair) public view returns (Observation memory firstObservation) {
        uint8 observationIndex = observationIndexOf(block.timestamp);
        uint8 firstObservationIndex = (observationIndex + 1) % granularity;
        firstObservation = pairObservations[pair][firstObservationIndex];
    }

    function currentCumulativePrice(address pair) public view returns (uint256 price0Cumulative, uint256 price1Cumulative) {
        uint32 blockTimestamp = uint32(block.timestamp % 2 ** 32);
        price0Cumulative = IFathomSwapPair(pair).price0CumulativeLast();
        price1Cumulative = IFathomSwapPair(pair).price1CumulativeLast();

        // if time has elapsed since the last update on the pair, mock the accumulated price values
        (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast) = IFathomSwapPair(pair).getReserves();
        if (blockTimestampLast != blockTimestamp) {
            uint32 timeElapsed = blockTimestamp - blockTimestampLast;
            price0Cumulative += _fraction(reserve1, reserve0) * timeElapsed;
            price1Cumulative += _fraction(reserve0, reserve1) * timeElapsed;
        }
    }

    function _fraction(uint256 a, uint256 b) private pure returns (uint256 result) {
        result = (a << RESOLUTION) / b;
    }

    function _toDecimals18(uint256 _amount, uint _fromDecimals) private pure returns (uint256 result) {
        result = _fromDecimals < 18 ? _amount * (10 ** (18 - _fromDecimals)) : _amount / (10 ** (_fromDecimals - 18));
    }
}
