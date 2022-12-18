// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

interface IFathomVaultConfig {
    /// @dev Return minimum BaseToken debt size per position.
    function minDebtSize() external view returns (uint256);

    /// @dev Return the interest rate per second, using 1e18 as denom.
    function getInterestRate(uint256 debt, uint256 floating) external view returns (uint256);

    function getWrappedNativeAddr() external view returns (address);

    function getWNativeRelayer() external view returns (address);

    function getFairLaunchAddr() external view returns (address);

    function getReservePoolBps() external view returns (uint256);

    function getKillBps() external view returns (uint256);

    function whitelistedCallers(address caller) external returns (bool);

    function whitelistedLiquidators(address caller) external returns (bool);

    function approvedAddStrategies(address addStrats) external returns (bool);

    function isWorker(address worker) external view returns (bool);

    function acceptDebt(address worker) external view returns (bool);

    /// @dev Return the work factor for the worker + BaseToken debt, using 1e4 as denom. Revert on non-worker.
    function workFactor(address worker, uint256 debt) external view returns (uint256);

    /// @dev Return the kill factor for the worker + BaseToken debt, using 1e4 as denom. Revert on non-worker.
    function killFactor(address worker, uint256 debt) external view returns (uint256);

    /// @dev Return the kill factor for the worker + BaseToken debt without checking isStable, using 1e4 as denom. Revert on non-worker.
    function rawKillFactor(address worker, uint256 debt) external view returns (uint256);

    /// @dev Return the portion of reward that will be transferred to treasury account after successfully killing a position.
    function getKillTreasuryBps() external view returns (uint256);

    function getTreasuryAddr() external view returns (address);

    function isWorkerStable(address worker) external view returns (bool);

    function isWorkerReserveConsistent(address worker) external view returns (bool);
}
