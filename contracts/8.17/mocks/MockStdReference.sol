// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity 0.8.17;
pragma experimental ABIEncoderV2;

import "../interfaces/IPriceFeed.sol";
import "../interfaces/IStdReference.sol";

contract MockStdReference is IStdReference {
  function getReferenceData(string memory _base, string memory _quote)
    external
    pure
    override
    returns (IStdReference.ReferenceData memory data)
  {
    data.rate = 0;
    data.lastUpdatedBase = 0;
    data.lastUpdatedQuote = 0;
  }

  function getReferenceDataBulk(string[] memory _bases, string[] memory _quotes)
    external
    pure
    override
    returns (IStdReference.ReferenceData[] memory arr)
  {
    return arr;
  }
}
