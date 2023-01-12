// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "../interfaces/IAuthTokenAdapter.sol";
import "../interfaces/IStablecoinAdapter.sol";

interface IStableSwapModule {
    function swapTokenToStablecoin(address _usr,uint256 _tokenAmoun) external;

    function swapStablecoinToToken(address _usr,uint256 _tokenAmount) external;
   
    function depositToken(address _token,uint256 _amount) external;
   
    function withdrawFees(address _account) external;

    function emergencyWithdraw(address _account) external;
}
