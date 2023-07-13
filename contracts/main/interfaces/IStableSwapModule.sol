// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

interface IStableSwapModule {
    function swapTokenToStablecoin(address _usr, uint256 _tokenAmount) external;

    function swapStablecoinToToken(address _usr, uint256 _tokenAmount) external;

    function depositToken(address _token, uint256 _amount) external;
    function withdrawFees(address _destination, uint256 _amountFXDFee, uint256 _amountTokenFee) external;
    function emergencyWithdraw(address _account) external;
    function withdrawToken(address _token, uint256 _amount) external;
    function stablecoin() external view returns (address);
    function token() external view returns (address);
    function tokenBalance(address) external view returns (uint256);
    function remainingFXDFeeBalance() external view returns (uint256);
    function remainingTokenFeeBalance() external view returns (uint256);
}
