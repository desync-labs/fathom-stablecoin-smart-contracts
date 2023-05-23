// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import "../interfaces/IToken.sol";
import "../interfaces/IStablecoinAdapter.sol";
import "../interfaces/IStablecoin.sol";
import "../interfaces/IBookKeeper.sol";
import "../interfaces/IStableSwapModule.sol";
import "../utils/SafeToken.sol";

// Stable Swap Module
// Allows anyone to go between FUSD and the Token by pooling the liquidity
// An optional fee is charged for incoming and outgoing transfers
contract StableSwapModuleWrapper is PausableUpgradeable, ReentrancyGuardUpgradeable {
    using SafeToken for address;

    address public stablecoin;
    address public token;
    address public stableSwapModule;
    bool public isDecentralizedState;

    mapping(address => uint256) public depositTracker;

    mapping(address => bool) public whiteListed;

    event LogDepositTokens(address indexed _depositor, uint256 _amount);
    event LogWithdrawTokens(address indexed _depositor, uint256 _amount);

    modifier onlyOwner() {
        IAccessControlConfig _accessControlConfig = IAccessControlConfig(bookKeeper.accessControlConfig());
        require(_accessControlConfig.hasRole(_accessControlConfig.OWNER_ROLE(), msg.sender), "!ownerRole");
        _;
    }

    modifier onlyOwnerOrGov() {
        IAccessControlConfig _accessControlConfig = IAccessControlConfig(IBookKeeper(bookKeeper).accessControlConfig());
        require(
            _accessControlConfig.hasRole(_accessControlConfig.OWNER_ROLE(), msg.sender) ||
                _accessControlConfig.hasRole(_accessControlConfig.GOV_ROLE(), msg.sender),
            "!(ownerRole or govRole)"
        );
        _;
    }

    modifier onlyWhitelistedIfNotDecentralized() {
        if (!isDecentralizedState) {
            require(usersWhitelist[msg.sender], "user-not-whitelisted");
        }
        _;
    }

    function initialize(
        address _token,
        address _stablecoin,
    ) external initializer {
        PausableUpgradeable.__Pausable_init();
        ReentrancyGuardUpgradeable.__ReentrancyGuard_init();
        stablecoin = _stablecoin;
        token = _token;
    }

    function addToWhitelist(address _user) external onlyOwner {
        usersWhitelist[_user] = true;
        emit LogAddToWhitelist(_user);
    }

    function removeFromWhitelist(address _user) external onlyOwner {
        usersWhitelist[_user] = false;
        emit LogRemoveFromWhitelist(_user);
    }

    //@Dev _amount arg should be in 18 decimals
]
    function depositTokens(uint256 _amount) external override nonReentrant whenNotPaused onlyWhitelistedIfNotDecentralized{
     require(_amount != 0, "depositTokens/amount-zero");
        require(IToken(token).balanceOf(msg.sender) >= _amount, "depositTokens/token-not-enough");
        require(IToken(stablecoin).balanceOf(msg.sender) >= _amount, "depositTokens/FXD-not-enough");
        
        _amount6Decimals += _convertDecimals(_amount, IToken(_token).decimals(), 6);

        IToken(token).safeTransferFrom(msg.sender, address(this), _amount6Decimals);
        IToken(token).approve(stableSwapModule, _amount6Decimals);
        IStableSwapModule(stableSwapModule).depositToken(token, _amount6Decimals)
        
        IToken(stablecoin).safeTransferFrom(msg.sender, address(this), _amount);
        IToken(stablecoin).approve(stableSwapModule, _amount);
        IStableSwapModule(stableSwapModule).depositToken(stablecoin, _amount)

        //then call deposit fn for stablecoin
//deposit tracker is saving only half of total token amount, later when
        //withdrawl happens
        // ( depositTracker * 2 ) * ratioOfStablecoin in SSM 
        // 
        // ( depositTracker * 2 ) * ratioOfToken in SSM 
        //need to be sent to withdrawer, of course, for token withdrawl, conversion
        //of decimals will be done
         depositTracker[msg.sender] += _amount;

    event LogDepositTokens(address indexed _depositor, uint256 _amount);
    }

    function withdrawTokens(uint256 _amount) external override nonReentrant whenNotPaused onlyWhitelistedIfNotDecentralized{
     require(_amount != 0, "depositStablecoin/amount-zero");
         
        depositTracker[msg.sender] -= _amount;

        _amount6Decimals += _convertDecimals(_amount, IToken(_token).decimals(), 6);

        IToken(token).safeTransferFrom(address(this), msg.sender, _amount6Decimals);
        IToken(stablecoin).safeTransferFrom(address(this), msg.sender, _amount);

      totalValueDeposited += _convertDecimals(_amount, IToken(_token).decimals(), 18);
        //deposit tracker is saving only half of total token amount, later when
        //withdrawl happens
        // ( depositTracker * 2 ) * ratioOfStablecoin in SSM 
        // 
        // ( depositTracker * 2 ) * ratioOfToken in SSM 
        //need to be sent to withdrawer, of course, for token withdrawl, conversion
        //of decimals will be done


         depositTracker[msg.sender] += totalValueDeposited * 2;

    event LogDepositTokens(address indexed _depositor, uint256 _amount);
    }




    function pause() external onlyOwnerOrGov {
        _pause();
        emit LogStableSwapPauseState(true);
    }

    function unpause() external onlyOwnerOrGov {
        _unpause();
        emit LogStableSwapPauseState(false);
    }




    function _convertDecimals(uint256 _amount, uint8 _fromDecimals, uint8 _toDecimals) internal pure returns (uint256 result) {
        result = _toDecimals >= _fromDecimals ? _amount * (10 ** (_toDecimals - _fromDecimals)) : _amount / (10 ** (_fromDecimals - _toDecimals));
    }
}
