// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.17;

interface ISubscriptionsRegistry {
    function masterSubscribe(address consumer, address aggregator) external;
    function setSubscriptionPrice(uint256 _subscriptionPrice) external;
    function isSubscribed(address consumer, address aggregator) external view returns (bool);
    function getSubscriptionDueTime(address consumer, address aggregator) external view returns (uint256);
    function getSubscriptionPrice() external view returns (uint256);
    function getTreasury() external view returns (address);
}
