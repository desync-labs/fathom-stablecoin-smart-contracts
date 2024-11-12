// SPDX-License-Identifier: MIT
// Original Copyright OpenZeppelin Contracts (last updated v4.5.0) (token/ERC20/extensions/ERC20Votes.sol)
// Copyright Fathom 2022

pragma solidity 0.8.17;

import "./ERC20Permit.sol";
import "../../../governance/extensions/IVotes.sol";
import "../../../../common/math/Math.sol";
import "../../../../common/cryptography/ECDSA.sol";
import "../../../../common/math/SafeCast.sol";

abstract contract ERC20Votes is IVotes, ERC20Permit {
    struct Checkpoint {
        uint32 fromBlock;
        uint224 votes;
    }

    mapping(address => address) private _delegates;
    mapping(address => Checkpoint[]) private _checkpoints;
    Checkpoint[] private _totalSupplyCheckpoints;

    bytes32 private constant _DELEGATION_TYPEHASH = keccak256("Delegation(address delegatee,uint256 nonce,uint256 expiry)");

    error InvalidNonce();
    error SignatureExpired();
    error BlockNotYetMined();
    error TotalSupplyOverflowsVotes();

    constructor(string memory name_, string memory symbol_) ERC20Permit(name_, symbol_) {}

    function delegate(address delegatee) external virtual override {
        _delegate(_msgSender(), delegatee);
    }

    function delegateBySig(address delegatee, uint256 nonce, uint256 expiry, uint8 v, bytes32 r, bytes32 s) external virtual override {
        // solhint-disable-next-line not-rely-on-time
        if (block.timestamp > expiry) {
            revert SignatureExpired();
        }
        address signer = ECDSA.recover(_hashTypedDataV4(keccak256(abi.encode(_DELEGATION_TYPEHASH, delegatee, nonce, expiry))), v, r, s);
        if (nonce != _useNonce(signer)) {
            revert InvalidNonce();
        }
        _delegate(signer, delegatee);
    }

    function checkpoints(address account, uint32 pos) external view virtual returns (Checkpoint memory) {
        return _checkpoints[account][pos];
    }

    function numCheckpoints(address account) external view virtual returns (uint32) {
        return SafeCast.toUint32(_checkpoints[account].length);
    }

    function getVotes(address account) external view virtual override returns (uint256) {
        uint256 pos = _checkpoints[account].length;
        return pos == 0 ? 0 : _checkpoints[account][pos - 1].votes;
    }

    function getPastVotes(address account, uint256 blockNumber) external view virtual override returns (uint256) {
        if (blockNumber >= block.number) {
            revert BlockNotYetMined();
        }
        return _checkpointsLookup(_checkpoints[account], blockNumber);
    }

    function getPastTotalSupply(uint256 blockNumber) external view virtual override returns (uint256) {
        if (blockNumber >= block.number) {
            revert BlockNotYetMined();
        }
        return _checkpointsLookup(_totalSupplyCheckpoints, blockNumber);
    }

    function delegates(address account) public view virtual override returns (address) {
        return _delegates[account];
    }

    function _mint(address account, uint256 amount) internal virtual override {
        super._mint(account, amount);
        if (totalSupply() > _maxSupply()) {
            revert TotalSupplyOverflowsVotes();
        }

        _writeCheckpoint(_totalSupplyCheckpoints, _add, amount);
    }

    function _burn(address account, uint256 amount) internal virtual override {
        super._burn(account, amount);

        _writeCheckpoint(_totalSupplyCheckpoints, _subtract, amount);
    }

    function _afterTokenTransfer(address from, address to, uint256 amount) internal virtual override {
        super._afterTokenTransfer(from, to, amount);

        _moveVotingPower(delegates(from), delegates(to), amount);
    }

    function _delegate(address delegator, address delegatee) internal virtual {
        address currentDelegate = delegates(delegator);
        uint256 delegatorBalance = balanceOf(delegator);
        _delegates[delegator] = delegatee;

        emit DelegateChanged(delegator, currentDelegate, delegatee);

        _moveVotingPower(currentDelegate, delegatee, delegatorBalance);
    }

    function _maxSupply() internal view virtual returns (uint224) {
        return type(uint224).max;
    }

    function _moveVotingPower(address src, address dst, uint256 amount) private {
        if (src != dst && amount > 0) {
            if (src != address(0)) {
                (uint256 oldWeight, uint256 newWeight) = _writeCheckpoint(_checkpoints[src], _subtract, amount);
                emit DelegateVotesChanged(src, oldWeight, newWeight);
            }

            if (dst != address(0)) {
                (uint256 oldWeight, uint256 newWeight) = _writeCheckpoint(_checkpoints[dst], _add, amount);
                emit DelegateVotesChanged(dst, oldWeight, newWeight);
            }
        }
    }

    function _writeCheckpoint(
        Checkpoint[] storage ckpts,
        function(uint256, uint256) view returns (uint256) op,
        uint256 delta
    ) private returns (uint256 oldWeight, uint256 newWeight) {
        uint256 pos = ckpts.length;
        oldWeight = pos == 0 ? 0 : ckpts[pos - 1].votes;
        newWeight = op(oldWeight, delta);

        if (pos > 0 && ckpts[pos - 1].fromBlock == block.number) {
            ckpts[pos - 1].votes = SafeCast.toUint224(newWeight);
        } else {
            ckpts.push(Checkpoint({ fromBlock: SafeCast.toUint32(block.number), votes: SafeCast.toUint224(newWeight) }));
        }
    }

    function _checkpointsLookup(Checkpoint[] storage ckpts, uint256 blockNumber) private view returns (uint256) {
        // We run a binary search to look for the earliest checkpoint taken after `blockNumber`.
        //
        // During the loop, the index of the wanted checkpoint remains in the range [low-1, high).
        // With each iteration, either `low` or `high` is moved towards the middle of the range to maintain the
        //  invariant.
        // - If the middle checkpoint is after `blockNumber`, we look in [low, mid)
        // - If the middle checkpoint is before or equal to `blockNumber`, we look in [mid+1, high)
        // Once we reach a single value (when low == high), we've found the right checkpoint at the index high-1, if not
        // out of bounds (in which case we're looking too far in the past and the result is 0).
        // Note that if the latest checkpoint available is exactly for `blockNumber`, we end up with an index that is
        // past the end of the array, so we technically don't find a checkpoint after `blockNumber`, but it works out
        // the same.
        uint256 high = ckpts.length;
        uint256 low = 0;
        while (low < high) {
            uint256 mid = Math.average(low, high);
            if (ckpts[mid].fromBlock > blockNumber) {
                high = mid;
            } else {
                low = mid + 1;
            }
        }

        return high == 0 ? 0 : ckpts[high - 1].votes;
    }

    function _add(uint256 a, uint256 b) private pure returns (uint256) {
        return a + b;
    }

    function _subtract(uint256 a, uint256 b) private pure returns (uint256) {
        return a - b;
    }
}
