// SPDX-License-Identifier: AGPL 3.0
// Original Copyright Aurora
// Copyright Fathom 2022

pragma solidity 0.8.17;
import "../interfaces/IVault.sol";
import "../interfaces/IVaultEvents.sol";
import "../../../tokens/ERC20/IERC20.sol";
import "../../../../common/security/AdminPausable.sol";
import "../../../../common/SafeERC20.sol";
import "../../../../common/introspection/ERC165.sol";

// solhint-disable not-rely-on-time
contract VaultPackage is IVault, IVaultEvents, AdminPausable {
    using SafeERC20 for IERC20;

    mapping(address => uint256) public deposited;
    mapping(address => bool) public override isSupportedToken;
    address[] public listOfSupportedTokens;
    bool public override migrated;

    bytes32 public constant REWARDS_OPERATOR_ROLE = keccak256("REWARDS_OPERATOR_ROLE");

    error NoRewardsOperatorRole();
    error UnsupportedToken();
    error AmountZero();
    error InsufficientDeposit();
    error VaultMigrated();
    error TokenAlreadyExists();
    error TokenInUse();
    error ZeroAddress();
    error RequiredPause();

    constructor() {
        _disableInitializers();
    }

    function initVault(address _admin, address[] calldata supportedTokens) external override initializer {
        for (uint256 i = 0; i < supportedTokens.length; i++) {
            _addSupportedToken(supportedTokens[i]);
        }
        pausableInit(0, _admin);
    }

    function addRewardsOperator(address _rewardsOperator) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(REWARDS_OPERATOR_ROLE, _rewardsOperator);
    }

    function payRewards(address _user, address _token, uint256 _amount) external override pausable(1) {
        if (!hasRole(REWARDS_OPERATOR_ROLE, msg.sender)) revert NoRewardsOperatorRole();
        if (!isSupportedToken[_token]) revert UnsupportedToken();
        if (_amount == 0) revert AmountZero();
        if (deposited[_token] < _amount) revert InsufficientDeposit();
        if (migrated) revert VaultMigrated();

        uint256 previousBalance = IERC20(_token).balanceOf(address(this));
        IERC20(_token).safeTransfer(_user, _amount);
        uint256 newBalance = IERC20(_token).balanceOf(address(this));
        uint256 trueDeposit = previousBalance - newBalance;
        deposited[_token] -= trueDeposit;
    }

    function deposit(address _token, uint256 _amount) external override pausable(1) {
        if (!hasRole(REWARDS_OPERATOR_ROLE, msg.sender)) revert NoRewardsOperatorRole();
        if (!isSupportedToken[_token]) revert UnsupportedToken();
        if (migrated) revert VaultMigrated();

        uint256 previousBalance = IERC20(_token).balanceOf(address(this));
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
        uint256 newBalance = IERC20(_token).balanceOf(address(this));
        uint256 trueDeposit = newBalance - previousBalance;
        deposited[_token] += trueDeposit;
    }

    /// @notice adds token as a supported rewards token by Vault
    /// supported tokens means any future stream token should be
    /// allowlisted here
    /// @param _token stream ERC20 token address
    function addSupportedToken(address _token) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        if (migrated) revert VaultMigrated();
        _addSupportedToken(_token);
    }

    /// @notice removed token as a supported rewards token by Treasury
    /// @param _token stream ERC20 token address
    function removeSupportedToken(address _token) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        if (migrated) revert VaultMigrated();
        if (!isSupportedToken[_token]) revert UnsupportedToken();
        if (deposited[_token] > 0) revert TokenInUse();

        isSupportedToken[_token] = false;
        _removeToken(_token);
        emit TokenRemoved(_token, msg.sender, block.timestamp);
    }

    function withdrawExtraSupportedTokens(address _withdrawTo) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        for (uint256 i = 0; i < listOfSupportedTokens.length; i++) {
            uint256 balanceToWithdraw;
            address _token = listOfSupportedTokens[i];
            uint256 balanceInContract = IERC20(_token).balanceOf(address(this));
            if (balanceInContract > deposited[_token]) {
                balanceToWithdraw = balanceInContract - deposited[_token];
            }
            if (balanceToWithdraw > 0) {
                IERC20(_token).safeTransfer(_withdrawTo, balanceToWithdraw);
            }
        }
    }

    function withdrawExtraUnsupportedToken(address _token, address _withdrawTo) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        if (isSupportedToken[_token]) revert TokenAlreadyExists();
        uint256 balanceInContract = IERC20(_token).balanceOf(address(this));
        if (balanceInContract > 0) {
            IERC20(_token).safeTransfer(_withdrawTo, balanceInContract);
        }
    }

    /// @notice we believe newVaultPackage is safe
    function migrate(address newVaultPackage) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        if (migrated) revert VaultMigrated();
        if (paused == 0) revert RequiredPause();
        if (newVaultPackage == address(0)) revert ZeroAddress();

        for (uint256 i = 0; i < listOfSupportedTokens.length; i++) {
            address token = listOfSupportedTokens[i];
            deposited[token] = 0;
            IERC20(token).safeApprove(newVaultPackage, deposited[token]);
            IVault(newVaultPackage).deposit(listOfSupportedTokens[i], deposited[token]);
        }
        migrated = true;
    }

    function supportsInterface(bytes4 interfaceId) public pure override returns (bool) {
        return interfaceId == type(IERC165).interfaceId || interfaceId == type(IVault).interfaceId;
    }

    function _addSupportedToken(address _token) internal {
        if (isSupportedToken[_token]) revert TokenAlreadyExists();
        isSupportedToken[_token] = true;
        listOfSupportedTokens.push(_token);
        emit TokenAdded(_token, msg.sender, block.timestamp);
    }

    function _removeToken(address _token) internal {
        for (uint256 i = 0; i < listOfSupportedTokens.length; i++) {
            if (listOfSupportedTokens[i] == _token) {
                listOfSupportedTokens[i] = listOfSupportedTokens[listOfSupportedTokens.length - 1];
                break;
            }
        }
        listOfSupportedTokens.pop();
    }
}
