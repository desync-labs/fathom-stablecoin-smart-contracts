// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

/**
 * @title FathomBridge
 * @notice A contract which acts as an entrypoint for bridging Fathom Stablecoin.
 * It has the ability to mint FXD in the source chain and burn FXD in the destination chain.
 * _initializerLib contract needs to exist prior to the deployment of this smart contract. 
 * Please refer to below documentation for the list of deployed AsterizmInitializerLib contract
 * https://docs.asterizm.io/technical-reference/mainnet
 * This contract, like FathomProxyAdmin&FathomProxyFactory, has its own owner outside of Fathom Protocol's accessControlSystem due to inheritance of AsterizmClientUpgradeableTransparency
 * Have the off-chain client module as the OZ owner of this contract to manage bridge related operations
 */

interface IFathomBridge {

    event LogAddToWhitelist(address indexed _user);
    event LogRemoveFromWhitelist(address indexed _user);
    event LogSetFee(uint256 _newFee);
    event LogWithdrawFees(address indexed _withdrawer, address indexed _to, uint256 _amount);
    event LogFeeCollection(address indexed _from, uint256 _amount, uint256 _txId);
    event LogSetDecentralizedMode(bool _newValue);
    event LogCrossChainTransferOut(uint64 indexed _dstChainId, address indexed _from, address indexed _to, uint256 _amount, uint256 _txId);
    event LogCrossChainTransferIn(uint64 indexed  _srcChainId, address indexed _from, address indexed _to, uint256 _amount);


    function crossChainTransfer(uint64 _dstChainId, address _to, uint _amount) external;

    function totalBridgedInAmount() external view returns (uint256);

    function totalBridgedOutAmount() external view returns (uint256);

}
