// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract FathomToken is ERC20("FathomToken", "FTHM"), Ownable {
    uint256 private constant CAP = 18800000000000000000000e18;
    uint256 private _totalLock;

    uint256 public debugFlag;

    uint256 public startReleaseBlock;
    uint256 public endReleaseBlock;
    uint256 public constant MANUAL_MINT_LIMIT = 18800000000000000000000e18;
    uint256 public manualMinted = 0;

    mapping(address => uint256) private _locks;
    mapping(address => uint256) private _lastUnlockBlock;

    event Lock(address indexed to, uint256 value);

    constructor(uint256 _startReleaseBlock, uint256 _endReleaseBlock) {
        require(_endReleaseBlock > _startReleaseBlock, "endReleaseBlock < startReleaseBlock");
        startReleaseBlock = _startReleaseBlock;
        endReleaseBlock = _endReleaseBlock;

        // maunalMint for seeding liquidity
        manualMint(msg.sender, 5000000000000e18);
    }

    function cap() public pure returns (uint256) {
        return CAP;
    }

    function unlockedSupply() external view returns (uint256) {
        return totalSupply() - totalLock();
    }

    function totalLock() public view returns (uint256) {
        return _totalLock;
    }

    function manualMint(address _to, uint256 _amount) public onlyOwner {
        require(manualMinted + _amount <= MANUAL_MINT_LIMIT, "mint limit exceeded");
        manualMinted = manualMinted + _amount;
        mint(_to, _amount);
    }

    function mint(address _to, uint256 _amount) public onlyOwner {
        require(totalSupply() + _amount <= cap(), "cap exceeded");
        _mint(_to, _amount);
        _moveDelegates(address(0), _delegates[_to], _amount);
    }

    function burn(address _account, uint256 _amount) external onlyOwner {
        _burn(_account, _amount);
    }

    function transfer(address recipient, uint256 amount) public virtual override returns (bool) {
        _transfer(_msgSender(), recipient, amount);
        _moveDelegates(_delegates[_msgSender()], _delegates[recipient], amount);
        return true;
    }

    function transferFrom(address sender, address recipient, uint256 amount) public virtual override returns (bool) {
        _transfer(sender, recipient, amount);
        // uint256 amen = allowance(sender, _msgSender());
        // require( amen > amount, "ERC20: transfer amount exceeds allowance");
        // amen = (amen - amount);
        // _approve(
        //   sender,
        //   _msgSender(),
        //   amen
        // );
        uint256 allowanceTemp;
        if (allowance(sender, _msgSender()) >= amount) {
            allowanceTemp = allowance(sender, _msgSender()) - amount;
        } else {
            revert("ERC20: transfer amount exceeds allowance");
        }

        _approve(sender, _msgSender(), allowanceTemp);

        _moveDelegates(_delegates[sender], _delegates[recipient], amount);
        return true;
    }

    function totalBalanceOf(address _account) external view returns (uint256) {
        return _locks[_account] + balanceOf(_account);
    }

    function lockOf(address _account) external view returns (uint256) {
        return _locks[_account];
    }

    function lastUnlockBlock(address _account) external view returns (uint256) {
        return _lastUnlockBlock[_account];
    }

    function lock(address _account, uint256 _amount) external onlyOwner {
        require(_account != address(0), "no lock to address(0)");
        require(_amount <= balanceOf(_account), "no lock over balance");

        _transfer(_account, address(this), _amount);

        _locks[_account] = _locks[_account] + _amount;
        _totalLock = _totalLock + _amount;

        if (_lastUnlockBlock[_account] < startReleaseBlock) {
            _lastUnlockBlock[_account] = startReleaseBlock;
        }

        emit Lock(_account, _amount);
    }

    function canUnlockAmount(address _account) public view returns (uint256) {
        // When block number less than startReleaseBlock, no FATHOMs can be unlocked
        if (block.number < startReleaseBlock) {
            return 0;
        }
        // When block number more than endReleaseBlock, all locked FATHOMs can be unlocked
        else if (block.number >= endReleaseBlock) {
            return _locks[_account];
        }
        // When block number is more than startReleaseBlock but less than endReleaseBlock,
        // some FATHOMs can be released
        else {
            uint256 releasedBlock = block.number - _lastUnlockBlock[_account];
            uint256 blockLeft = endReleaseBlock - _lastUnlockBlock[_account];
            return (_locks[_account] * releasedBlock) / blockLeft;
        }
    }

    function unlock() external {
        require(_locks[msg.sender] > 0, "no locked FATHOMs");

        uint256 amount = canUnlockAmount(msg.sender);

        _transfer(address(this), msg.sender, amount);
        _locks[msg.sender] = _locks[msg.sender] - amount;
        _lastUnlockBlock[msg.sender] = block.number;
        _totalLock = _totalLock - amount;
    }

    // @dev move FATHOMs with its locked funds to another account
    function transferAll(address _to) external {
        require(msg.sender != _to, "no self-transferAll");

        _locks[_to] = _locks[_to] + _locks[msg.sender];

        if (_lastUnlockBlock[_to] < startReleaseBlock) {
            _lastUnlockBlock[_to] = startReleaseBlock;
        }

        if (_lastUnlockBlock[_to] < _lastUnlockBlock[msg.sender]) {
            _lastUnlockBlock[_to] = _lastUnlockBlock[msg.sender];
        }

        _locks[msg.sender] = 0;
        _lastUnlockBlock[msg.sender] = 0;

        _transfer(msg.sender, _to, balanceOf(msg.sender));
    }

    // Copied and modified from YAM code:
    // https://github.com/yam-finance/yam-protocol/blob/master/contracts/token/YAMGovernanceStorage.sol
    // https://github.com/yam-finance/yam-protocol/blob/master/contracts/token/YAMGovernance.sol
    // Which is copied and modified from COMPOUND:
    // https://github.com/compound-finance/compound-protocol/blob/master/contracts/Governance/Comp.sol

    /// @notice A record of each accounts delegate
    mapping(address => address) internal _delegates;

    /// @notice A checkpoint for marking number of votes from a given block
    struct Checkpoint {
        uint32 fromBlock;
        uint256 votes;
    }

    /// @notice A record of votes checkpoints for each account, by index
    mapping(address => mapping(uint32 => Checkpoint)) public checkpoints;

    /// @notice The number of checkpoints for each account
    mapping(address => uint32) public numCheckpoints;

    /// @notice The EIP-712 typehash for the contract's domain
    bytes32 public constant DOMAIN_TYPEHASH = keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)");

    /// @notice The EIP-712 typehash for the delegation struct used by the contract
    bytes32 public constant DELEGATION_TYPEHASH = keccak256("Delegation(address delegatee,uint256 nonce,uint256 expiry)");

    /// @notice A record of states for signing / validating signatures
    mapping(address => uint256) public nonces;

    /// @notice An event thats emitted when an account changes its delegate
    event DelegateChanged(address indexed delegator, address indexed fromDelegate, address indexed toDelegate);

    /// @notice An event thats emitted when a delegate account's vote balance changes
    event DelegateVotesChanged(address indexed delegate, uint256 previousBalance, uint256 newBalance);

    /**
     * @notice Delegate votes from `msg.sender` to `delegatee`
     * @param delegator The address to get delegatee for
     */
    function delegates(address delegator) external view returns (address) {
        return _delegates[delegator];
    }

    /**
     * @notice Delegate votes from `msg.sender` to `delegatee`
     * @param delegatee The address to delegate votes to
     */
    function delegate(address delegatee) external {
        return _delegate(msg.sender, delegatee);
    }

    /**
     * @notice Delegates votes from signatory to `delegatee`
     * @param delegatee The address to delegate votes to
     * @param nonce The contract state required to match the signature
     * @param expiry The time at which to expire the signature
     * @param v The recovery byte of the signature
     * @param r Half of the ECDSA signature pair
     * @param s Half of the ECDSA signature pair
     */
    function delegateBySig(address delegatee, uint256 nonce, uint256 expiry, uint8 v, bytes32 r, bytes32 s) external {
        bytes32 domainSeparator = keccak256(abi.encode(DOMAIN_TYPEHASH, keccak256(bytes(name())), getChainId(), address(this)));

        bytes32 structHash = keccak256(abi.encode(DELEGATION_TYPEHASH, delegatee, nonce, expiry));

        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));

        address signatory = ecrecover(digest, v, r, s);
        require(signatory != address(0), "FATHOM::delegateBySig: invalid signature");
        require(nonce == nonces[signatory]++, "FATHOM::delegateBySig: invalid nonce");
        require(block.timestamp <= expiry, "FATHOM::delegateBySig: signature expired");
        return _delegate(signatory, delegatee);
    }

    /**
     * @notice Gets the current votes balance for `account`
     * @param account The address to get votes balance
     * @return The number of current votes for `account`
     */
    function getCurrentVotes(address account) external view returns (uint256) {
        uint32 nCheckpoints = numCheckpoints[account];
        return nCheckpoints > 0 ? checkpoints[account][nCheckpoints - 1].votes : 0;
    }

    /**
     * @notice Determine the prior number of votes for an account as of a block number
     * @dev Block number must be a finalized block or else this function will revert to prevent misinformation.
     * @param account The address of the account to check
     * @param blockNumber The block number to get the vote balance at
     * @return The number of votes the account had as of the given block
     */
    function getPriorVotes(address account, uint256 blockNumber) external view returns (uint256) {
        require(blockNumber < block.number, "FATHOM::getPriorVotes: not yet determined");

        uint32 nCheckpoints = numCheckpoints[account];
        if (nCheckpoints == 0) {
            return 0;
        }

        // First check most recent balance
        if (checkpoints[account][nCheckpoints - 1].fromBlock <= blockNumber) {
            return checkpoints[account][nCheckpoints - 1].votes;
        }

        // Next check implicit zero balance
        if (checkpoints[account][0].fromBlock > blockNumber) {
            return 0;
        }

        uint32 lower = 0;
        uint32 upper = nCheckpoints - 1;
        while (upper > lower) {
            uint32 center = upper - (upper - lower) / 2; // ceil, avoiding overflow
            Checkpoint memory cp = checkpoints[account][center];
            if (cp.fromBlock == blockNumber) {
                return cp.votes;
            } else if (cp.fromBlock < blockNumber) {
                lower = center;
            } else {
                upper = center - 1;
            }
        }
        return checkpoints[account][lower].votes;
    }

    function _delegate(address delegator, address delegatee) internal {
        address currentDelegate = _delegates[delegator];
        uint256 delegatorBalance = balanceOf(delegator); // balance of underlying FATHOMs (not scaled);
        _delegates[delegator] = delegatee;

        emit DelegateChanged(delegator, currentDelegate, delegatee);

        _moveDelegates(currentDelegate, delegatee, delegatorBalance);
    }

    function _moveDelegates(address srcRep, address dstRep, uint256 amount) internal {
        if (srcRep != dstRep && amount > 0) {
            if (srcRep != address(0)) {
                // decrease old representative
                uint32 srcRepNum = numCheckpoints[srcRep];
                uint256 srcRepOld = srcRepNum > 0 ? checkpoints[srcRep][srcRepNum - 1].votes : 0;
                uint256 srcRepNew = srcRepOld - amount;
                _writeCheckpoint(srcRep, srcRepNum, srcRepOld, srcRepNew);
            }

            if (dstRep != address(0)) {
                // increase new representative
                uint32 dstRepNum = numCheckpoints[dstRep];
                uint256 dstRepOld = dstRepNum > 0 ? checkpoints[dstRep][dstRepNum - 1].votes : 0;
                uint256 dstRepNew = dstRepOld + amount;
                _writeCheckpoint(dstRep, dstRepNum, dstRepOld, dstRepNew);
            }
        }
    }

    function _writeCheckpoint(address delegatee, uint32 nCheckpoints, uint256 oldVotes, uint256 newVotes) internal {
        uint32 blockNumber = safe32(block.number, "FATHOM::_writeCheckpoint: block number exceeds 32 bits");

        if (nCheckpoints > 0 && checkpoints[delegatee][nCheckpoints - 1].fromBlock == blockNumber) {
            checkpoints[delegatee][nCheckpoints - 1].votes = newVotes;
        } else {
            checkpoints[delegatee][nCheckpoints] = Checkpoint(blockNumber, newVotes);
            numCheckpoints[delegatee] = nCheckpoints + 1;
        }

        emit DelegateVotesChanged(delegatee, oldVotes, newVotes);
    }

    function safe32(uint256 n, string memory errorMessage) internal pure returns (uint32) {
        require(n < 2 ** 32, errorMessage);
        return uint32(n);
    }

    function getChainId() internal view returns (uint256) {
        uint256 chainId;
        assembly {
            chainId := chainid()
        }
        return chainId;
    }
}
