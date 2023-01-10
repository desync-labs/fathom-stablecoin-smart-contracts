// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";


import "../../../../utils/BytesHelper.sol";

import "../../../interfaces/IBookKeeper.sol";
import "../../../interfaces/IFarmableTokenAdapter.sol";
import "../../../interfaces/ICagable.sol";
import "../../../interfaces/IManager.sol";
import "../../../utils/SafeToken.sol";

import "../../../apis/ankr/interfaces/IAnkrStakingPool.sol";
import "../../../apis/ankr/interfaces/ICertToken.sol";

/// @dev receives XDC from users and deposit in Ankr's staking. Hence, users will still earn reward from changing aXDCc ratio
contract AnkrCollateralAdapter is IFarmableTokenAdapter, PausableUpgradeable, ReentrancyGuardUpgradeable, ICagable {
    using SafeToken for address;
    using BytesHelper for *;

    uint256 internal constant WAD = 10 ** 18;
    uint256 internal constant RAY = 10 ** 27;

    struct RatioNCerts{
        uint256 ratio;
        uint256 CertsAmount;
    }

    uint256 public pid;

    uint256 public treasuryFeeBps;
    address public treasuryAccount;

    uint256 public live;

    IBookKeeper public bookKeeper;
    bytes32 public override collateralPoolId;
    //@Sangjun left below getter for compilation since interface of tokenAdapter requires collateralToken getter fn. Later needs to be removed for audit.
    address public override collateralToken;
    uint256 public override decimals;

    IManager public positionManager;

    IAnkrStakingPool public XDCPoolAddress;
    ICertToken public aXDCcAddress;

    /// @dev Total CollateralTokens that has been staked in WAD
    uint256 public totalShare;

    uint256 public treasuryFee = 100000000000000000;  // 0.1 WAD

    /// @dev Mapping of user(positionAddress) => recordRatioNCerts that he has ownership over.
    mapping(address => RatioNCerts) public recordRatioNCerts;
    /// @dev Mapping of user(positionAddress) => collteralTokens that he is staking
    mapping(address => uint256) public stake;

    uint256 internal to18ConversionFactor;
    uint256 internal toTokenConversionFactor;

    event LogDeposit(uint256 _val);
    event LogWithdraw(uint256 _val);
    event LogEmergencyWithdraw(address indexed _caller, address _to);
    event LogMoveStake(address indexed _src, address indexed _dst, uint256 _wad);
    event LogSetTreasuryAccount(address indexed _caller, address _treasuryAccount);
    event LogSetTreasuryFeeBps(address indexed _caller, uint256 _treasuryFeeBps);

    modifier onlyOwner() {
        IAccessControlConfig _accessControlConfig = IAccessControlConfig(bookKeeper.accessControlConfig());
        require(_accessControlConfig.hasRole(_accessControlConfig.OWNER_ROLE(), msg.sender), "!ownerRole");
        _;
    }

    modifier onlyOwnerOrGov() {
        IAccessControlConfig _accessControlConfig = IAccessControlConfig(bookKeeper.accessControlConfig());
        require(
            _accessControlConfig.hasRole(_accessControlConfig.OWNER_ROLE(), msg.sender) ||
                _accessControlConfig.hasRole(_accessControlConfig.GOV_ROLE(), msg.sender),
            "!(ownerRole or govRole)"
        );
        _;
    }

    modifier onlyCollateralManager() {
        IAccessControlConfig _accessControlConfig = IAccessControlConfig(bookKeeper.accessControlConfig());
        require(_accessControlConfig.hasRole(_accessControlConfig.COLLATERAL_MANAGER_ROLE(), msg.sender), "!collateralManager");
        _;
    }

    function initialize(
        address _bookKeeper,
        bytes32 _collateralPoolId,
        address _xdcPoolAddress,
        address _aXDCcAddress,
        uint256 _treasuryFeeBps,
        address _treasuryAccount,
        address _positionManager
    ) external initializer {
        // 1. Initialized all dependencies
        PausableUpgradeable.__Pausable_init();
        ReentrancyGuardUpgradeable.__ReentrancyGuard_init();

        XDCPoolAddress = IAnkrStakingPool(_xdcPoolAddress);
        aXDCcAddress = ICertToken(_aXDCcAddress);

        live = 1;

        bookKeeper = IBookKeeper(_bookKeeper);
        collateralPoolId = _collateralPoolId;

        decimals = aXDCcAddress.decimals();

        require(decimals <= 18, "CollateralTokenAdapter/decimals > 18");

        to18ConversionFactor = 10**(18 - decimals);
        toTokenConversionFactor = 10**decimals;

        require(_treasuryAccount != address(0), "CollateralTokenAdapter/bad treasury account");
        require(_treasuryFeeBps <= 5000, "CollateralTokenAdapter/bad treasury fee bps");
        treasuryFeeBps = _treasuryFeeBps;
        treasuryAccount = _treasuryAccount;

        positionManager = IManager(_positionManager);

    }

    function add(uint256 _x, uint256 _y) internal pure returns (uint256 _z) {
        require((_z = _x + _y) >= _x, "ds-math-add-overflow");
    }

    function sub(uint256 _x, uint256 _y) internal pure returns (uint256 _z) {
        require((_z = _x - _y) <= _x, "ds-math-sub-underflow");
    }

    function mul(uint256 _x, uint256 _y) internal pure returns (uint256 _z) {
        require(_y == 0 || (_z = _x * _y) / _y == _x, "ds-math-mul-overflow");
    }

    function div(uint256 _x, uint256 _y) internal pure returns (uint256 _z) {
        require(_y > 0, "ds-math-div-by-zero");
        _z = _x / _y;
    }

    function divup(uint256 _x, uint256 _y) internal pure returns (uint256 _z) {
        _z = add(_x, sub(_y, 1)) / _y;
    }

    function wmul(uint256 _x, uint256 _y) internal pure returns (uint256 _z) {
        _z = mul(_x, _y) / WAD;
    }

    function wdiv(uint256 _x, uint256 _y) internal pure returns (uint256 _z) {
        _z = mul(_x, WAD) / _y;
    }

    function wdivup(uint256 _x, uint256 _y) internal pure returns (uint256 _z) {
        _z = divup(mul(_x, WAD), _y);
    }

    function rmul(uint256 _x, uint256 _y) internal pure returns (uint256 _z) {
        _z = mul(_x, _y) / RAY;
    }

    function rmulup(uint256 _x, uint256 _y) internal pure returns (uint256 _z) {
        _z = divup(mul(_x, _y), RAY);
    }

    function rdiv(uint256 _x, uint256 _y) internal pure returns (uint256 _z) {
        _z = mul(_x, RAY) / _y;
    }

    function setTreasuryFeeBps(uint256 _treasuryFeeBps) external onlyOwner {
        require(live == 1, "CollateralTokenAdapter/not-live");
        require(_treasuryFeeBps <= 5000, "CollateralTokenAdapter/bad treasury fee bps");
        treasuryFeeBps = _treasuryFeeBps;
        emit LogSetTreasuryFeeBps(msg.sender, _treasuryFeeBps);
    }

    function setTreasuryAccount(address _treasuryAccount) external onlyOwner {
        require(live == 1, "CollateralTokenAdapter/not-live");
        require(_treasuryAccount != address(0), "CollateralTokenAdapter/bad treasury account");
        treasuryAccount = _treasuryAccount;
        emit LogSetTreasuryAccount(msg.sender, _treasuryAccount);
    }

    /// @dev Ignore collateralTokens that have been directly transferred
    function netAssetValuation() public view returns (uint256) {
        return totalShare;
    }

    /// @dev Return Net Assets per Share in wad
    function netAssetPerShare() public view returns (uint256) {
        if (totalShare == 0) return WAD;
        else return wdiv(netAssetValuation(), totalShare);
    }

    /// @param _positionAddress The address that holding states of the position
    /// @param _amount The XDC amount that being used as a collateral and to be staked to AnkrStakingPool
    /// @param _data The extra data that may needs to execute the deposit
    function deposit(address _positionAddress, uint256 _amount, bytes calldata _data) external payable override nonReentrant whenNotPaused {
        _deposit(_positionAddress, _amount, _data);
    }

    /// @dev Stake XDC to AnkrStakingPool, receive aXDCc and record
    /// deposit collateral tokens to staking contract, and update BookKeeper
    /// @param _positionAddress The position address to be updated
    /// @param _amount The amount to be deposited
    function _deposit(address _positionAddress, uint256 _amount, bytes calldata /* _data */) private {
    require(live == 1, "CollateralTokenAdapter/not live");
    require(_amount == msg.value, "CollateralTokenAdapter/DepositAmountMismatch");

    if (_amount > 0) {
      uint256 _share = wdiv(mul(_amount, to18ConversionFactor), netAssetPerShare()); // [wad]
      // Overflow check for int256(wad) cast below
      // Also enforces a non-zero wad
      require(int256(_share) > 0, "CollateralTokenAdapter/share-overflow");

      //bookKeeping
      bookKeeper.addCollateral(collateralPoolId, _positionAddress, int256(_share));
      totalShare = add(totalShare, _share);
      stake[_positionAddress] = add(stake[_positionAddress], _share);

      //record aXDCc amount before stakeCerts
      uint256 aXDCcBefore = aXDCcAddress.balanceOf(address(this));
      XDCPoolAddress.stakeCerts{value : msg.value}();
      uint256 aXDCcAfter = aXDCcAddress.balanceOf(address(this));

      uint256 certsIn = (aXDCcAfter - aXDCcBefore);
      RatioNCerts memory ratioNCerts = RatioNCerts(aXDCcAddress.ratio(), certsIn);

      // if it is first record of staking
      if (recordRatioNCerts[_positionAddress].ratio == 0 && recordRatioNCerts[_positionAddress].CertsAmount == 0) {
        recordRatioNCerts[_positionAddress] = ratioNCerts;
      } else {
      // if it is not the first record of staking
      // calculate weighted average of ratio from already existing ratio&CertsAmount and incoming ratio&CertsAmount
        uint256 certsBefore = recordRatioNCerts[_positionAddress].CertsAmount;
        uint256 ratioBefore = recordRatioNCerts[_positionAddress].ratio;
            //Q.. to make below calculation to ray cal. what to change
        uint256 aXDCcRatio = aXDCcAddress.ratio();
        uint256 calculatedNewRatio = 
          add(
              //precision lost wiht wmul since there is /WAD in the end
              //but thankfully, it makes the ratio lower than it actually is, so it's okei
          wmul(
          ratioBefore,
            //round down #1
            wdiv(certsBefore, 
              add(certsBefore,certsIn) 
            )
          ),
          wmul(
          aXDCcRatio,
            //round down #1
            wdiv(certsIn, 
              add(certsBefore,certsIn) 
            )
          )
        );
        //in case calculated new ratio is smaller(because of rounding down) or equal to aXDCcRatio on chain, make it same 
        if(calculatedNewRatio <= aXDCcRatio) {
        recordRatioNCerts[_positionAddress].ratio = aXDCcRatio;
        } else {
            recordRatioNCerts[_positionAddress].ratio = calculatedNewRatio;
        }

        recordRatioNCerts[_positionAddress].CertsAmount = add(recordRatioNCerts[_positionAddress].CertsAmount, certsIn);   
      }

    }

    emit LogDeposit(_amount);
    }

    /// @dev Withdraw aXDCc from AnkrCollateralAdapter
    /// @param _usr The address that holding states of the position
    /// @param _amount The ibToken amount to be withdrawn from FairLaunch and return to user
    function withdraw(address _usr, uint256 _amount, bytes calldata /* _data */) external override nonReentrant whenNotPaused {
        if (live == 1) {
            _withdraw(_usr, _amount);
        }
    }

    /// @dev   /// withdraw collateral tokens from staking contract, and update BookKeeper and update BookKeeper
    /// @param _usr The position address to be updated
    /// @param _amount The amount to be deposited
    function _withdraw(address _usr, uint256 _amount) private {

        if (_amount > 0) {
            uint256 _share = wdivup(mul(_amount, to18ConversionFactor), netAssetPerShare()); // [wad]
            // Overflow check for int256(wad) cast below
            // Also enforces a non-zero wad
            require(int256(_share) > 0, "CollateralTokenAdapter/share-overflow");
            require(stake[msg.sender] >= _share, "CollateralTokenAdapter/insufficient staked amount");

            bookKeeper.addCollateral(collateralPoolId, msg.sender, -int256(_share));
            totalShare = sub(totalShare, _share);
            stake[msg.sender] = sub(stake[msg.sender], _share);


            // *******below code is made for testing for testing flow without fee taking***********
            SafeToken.safeTransfer(address(aXDCcAddress), _usr, recordRatioNCerts[msg.sender].CertsAmount);
            // revert("AnkrColAdapter/RightAfterSafeTransfer");
            // *******above code is made for testing for testing flow without fee taking***********


            // *******commented out for testing flow without fee taking***********
            // uint256 ratio = recordRatioNCerts[msg.sender].ratio;
            // uint256 ratioaXDCc = aXDCcAddress.ratio();
            // uint256 certsAmount = recordRatioNCerts[msg.sender].CertsAmount;


            //2023 Taking fee should happen here

            //if ratio on recordRatioNCerts is less or equal to ratioaXDCc because of round down or whatever,
            //send all certs that the position owner has
            //because if ratio in a position is 0.7, and then ratio in aXDCc is 0.71, that means
            //there was no profit made. 

            // if (ratio <= ratioaXDCc) {
            //     SafeToken.safeTransfer(address(aXDCcAddress), _usr, certsAmount);
            // } else {
            //     //otherwise calculate reward and deduct fee, then transfer the rest of certs

            //     // 2023 let's keep smoothing here and there
            //     // compare it with certsAmount in proxy wallet,
            //     // the difference shall go to protocol(recorded in recordRatioNCerts)

            //     //maybe I should do it in RAY?
            //     //but below only has meaning only if we will take money from them.
            //     //let's test things out without fee taking and see how partial liquidation works.
            //     uint256 xdc0 = wdiv(certsAmount, ratio);
            //     uint256 xdc1 = wdiv(certsAmount, ratioaXDCc);
            //     // calculate reward
            //     uint256 reward = sub(xdc1, xdc0);
            //     // calculate fee
            //     uint256 fee = wmul(reward, treasuryFee);
            //     // calculate return amount
            //     uint256 returnAmount = wmul(add(sub(reward,fee), xdc0), ratioaXDCc);

            //     recordRatioNCerts[msg.sender] = RatioNCerts(0, 0);
            //     SafeToken.safeTransfer(address(aXDCcAddress), _usr, returnAmount);
            // }
            // *******commented out for testing flow without fee taking***********
        }
            emit LogWithdraw(_amount);
    }


    function moveStake(address _source, address _destination, uint256 _share, bytes calldata _data) external override nonReentrant whenNotPaused {
        _moveStake(_source, _destination, _share, _data);
    }

    /// @dev Move wad amount of staked balance from source to destination. Can only be moved if underlaying assets make sense.
    function _moveStake(address _source, address _destination, uint256 _share, bytes calldata /* data */) private onlyCollateralManager {
        // 1. Update collateral tokens for source and destination
        uint256 _stakedAmount = stake[_source];
        stake[_source] = sub(_stakedAmount, _share);
        stake[_destination] = add(stake[_destination], _share);
        // 2. Update source's rewardDebt due to collateral tokens have
        // 2022 Dec 23rd Fri. Reward toen can go away
        // moved from source to destination. Hence, rewardDebt should be updated.
        // rewardDebtDiff is how many rewards has been paid for that share.
        // uint256 _rewardDebt = rewardDebts[_source];
        // uint256 _rewardDebtDiff = mul(_rewardDebt, _share) / _stakedAmount;
        // 3. Update rewardDebts for both source and destination
        // 2022 Dec 23 Fri
        // Alpaca's reward system can go away
        // Safe since rewardDebtDiff <= rewardDebts[source]
        // rewardDebts[_source] = _rewardDebt - _rewardDebtDiff;
        // rewardDebts[_destination] = add(rewardDebts[_destination], _rewardDebtDiff);
        // 4. Sanity check.
        // - stake[source] must more than or equal to collateral + lockedCollateral that source has
        // to prevent a case where someone try to steal stake from source
        // - stake[destination] must less than or eqal to collateral + lockedCollateral that destination has
        // to prevent destination from claim stake > actual collateral that he has
        (uint256 _lockedCollateral, ) = bookKeeper.positions(collateralPoolId, _source);
        require(
        stake[_source] >= add(bookKeeper.collateralToken(collateralPoolId, _source), _lockedCollateral),
        "CollateralTokenAdapter/stake[source] < collateralTokens + lockedCollateral"
        );
        (_lockedCollateral, ) = bookKeeper.positions(collateralPoolId, _destination);
        require(
        stake[_destination] <= add(bookKeeper.collateralToken(collateralPoolId, _destination), _lockedCollateral),
        "CollateralTokenAdapter/stake[destination] > collateralTokens + lockedCollateral"
        );
        emit LogMoveStake(_source, _destination, _share);
    }

    function onAdjustPosition(
        address _source,
        address _destination,
        int256 _collateralValue,
        int256 /* debtShare */,
        bytes calldata _data
    ) external override nonReentrant whenNotPaused {
        uint256 _unsignedCollateralValue = _collateralValue < 0 ? uint256(-_collateralValue) : uint256(_collateralValue);
        _moveStake(_source, _destination, _unsignedCollateralValue, _data);
    }

    function onMoveCollateral(
        address _source,
        address _destination,
        uint256 _share,
        bytes calldata _data
    ) external override nonReentrant whenNotPaused {
        _deposit(_source, 0, _data);
        _moveCerts(_source, _destination, _share, _data);
        _moveStake(_source, _destination, _share, _data);
    }

    function _moveCerts(
        address _source,
        address _destination,
        uint256 _share,
        bytes calldata _data
  ) internal onlyCollateralManager {
        //stake might be not WAD but sth else
        uint256 certsToMoveRatio;
        // revert(string(_share._uintToASCIIBytes()));
        // revert(string(stake[_source]._uintToASCIIBytes()));
        // first closure, 1 XDC in, I ask for 0.3333
        // second closure 0.6666in, I asked for 0.3333
        //
        if(_share >= stake[_source]){
            uint256 CertsMove = recordRatioNCerts[_source].CertsAmount;
            recordRatioNCerts[_source].CertsAmount = 0;
            recordRatioNCerts[_destination].CertsAmount = CertsMove;
        } else {
            require(_share < stake[_source], "AnkrCollateralAdapter/tooMuchShare");
            certsToMoveRatio = wdiv(_share, stake[_source]);
        }
        uint256 certsMove = wmul(certsToMoveRatio, recordRatioNCerts[_source].CertsAmount);
        // revert(string(certsMove._uintToASCIIBytes()));

        //smoothing things out some numbers//intentionaly making some residual aXDCc made in certsMove
        //so that later when there will be full closure, rest of the residual aXDCc can be returned
        //to the user.
        certsMove = certsMove / (10**6) * (10**6);

        recordRatioNCerts[_source].CertsAmount -= certsMove;
        //destination should have ratio adjusted

        uint256 certsBefore = recordRatioNCerts[_destination].CertsAmount;
        uint256 ratioBefore = recordRatioNCerts[_destination].ratio;

        uint256 calculatedNewRatio = 
            add(
                wmul(
                ratioBefore,
                    wdiv(certsBefore, 
                        add(certsBefore,certsMove) 
                    )
                ),
                wmul(
                recordRatioNCerts[_source].ratio,
                    wdiv(certsMove, 
                        add(certsBefore,certsMove) 
                    )
                )
            );
        
        uint256 aXDCcRatio = aXDCcAddress.ratio();

        if(calculatedNewRatio <= aXDCcRatio) {
        recordRatioNCerts[_destination].ratio = aXDCcRatio;
        } else {
            recordRatioNCerts[_destination].ratio = calculatedNewRatio;
        }
        recordRatioNCerts[_destination].CertsAmount +=  certsMove;

  }


    function cage() external override nonReentrant {
        IAccessControlConfig _accessControlConfig = IAccessControlConfig(bookKeeper.accessControlConfig());
        require(
        _accessControlConfig.hasRole(_accessControlConfig.OWNER_ROLE(), msg.sender),
        "CollateralTokenAdapter/not-authorized"
        );
        require(live == 1, "CollateralTokenAdapter/not-live");
        live = 0;
        emit LogCage();
    }

    function uncage() external override onlyOwner {
        require(live == 0, "CollateralTokenAdapter/not-caged");
        live = 1;
        emit LogUncage();
    }

    function pause() external onlyOwnerOrGov {
        _pause();
    }

    function unpause() external onlyOwnerOrGov {
        _unpause();
    }
}
