import { newMockEvent } from "matchstick-as"
import { ethereum, Bytes, BigInt, Address } from "@graphprotocol/graph-ts"
import {
  Initialized,
  LogInitCollateralPoolId,
  LogSetAdapter,
  LogSetCloseFactorBps,
  LogSetDebtAccumulatedRate,
  LogSetDebtCeiling,
  LogSetDebtFloor,
  LogSetLiquidationRatio,
  LogSetLiquidatorIncentiveBps,
  LogSetPriceFeed,
  LogSetPriceWithSafetyMargin,
  LogSetStabilityFeeRate,
  LogSetStrategy,
  LogSetTotalDebtShare,
  LogSetTreasuryFeesBps,
  RoleAdminChanged,
  RoleGranted,
  RoleRevoked
} from "../generated/CollateralPoolConfig/CollateralPoolConfig"

export function createInitializedEvent(version: i32): Initialized {
  let initializedEvent = changetype<Initialized>(newMockEvent())

  initializedEvent.parameters = new Array()

  initializedEvent.parameters.push(
    new ethereum.EventParam(
      "version",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(version))
    )
  )

  return initializedEvent
}

export function createLogInitCollateralPoolIdEvent(
  _collateralPoolId: Bytes,
  _debtCeiling: BigInt,
  _liquidtionRatio: BigInt,
  _stabilityFeeRate: BigInt,
  _adapter: Address
): LogInitCollateralPoolId {
  let logInitCollateralPoolIdEvent = changetype<LogInitCollateralPoolId>(
    newMockEvent()
  )

  logInitCollateralPoolIdEvent.parameters = new Array()

  logInitCollateralPoolIdEvent.parameters.push(
    new ethereum.EventParam(
      "_collateralPoolId",
      ethereum.Value.fromFixedBytes(_collateralPoolId)
    )
  )
  logInitCollateralPoolIdEvent.parameters.push(
    new ethereum.EventParam(
      "_debtCeiling",
      ethereum.Value.fromUnsignedBigInt(_debtCeiling)
    )
  )
  logInitCollateralPoolIdEvent.parameters.push(
    new ethereum.EventParam(
      "_liquidtionRatio",
      ethereum.Value.fromUnsignedBigInt(_liquidtionRatio)
    )
  )
  logInitCollateralPoolIdEvent.parameters.push(
    new ethereum.EventParam(
      "_stabilityFeeRate",
      ethereum.Value.fromUnsignedBigInt(_stabilityFeeRate)
    )
  )
  logInitCollateralPoolIdEvent.parameters.push(
    new ethereum.EventParam("_adapter", ethereum.Value.fromAddress(_adapter))
  )

  return logInitCollateralPoolIdEvent
}

export function createLogSetAdapterEvent(
  _caller: Address,
  _collateralPoolId: Bytes,
  _adapter: Address
): LogSetAdapter {
  let logSetAdapterEvent = changetype<LogSetAdapter>(newMockEvent())

  logSetAdapterEvent.parameters = new Array()

  logSetAdapterEvent.parameters.push(
    new ethereum.EventParam("_caller", ethereum.Value.fromAddress(_caller))
  )
  logSetAdapterEvent.parameters.push(
    new ethereum.EventParam(
      "_collateralPoolId",
      ethereum.Value.fromFixedBytes(_collateralPoolId)
    )
  )
  logSetAdapterEvent.parameters.push(
    new ethereum.EventParam("_adapter", ethereum.Value.fromAddress(_adapter))
  )

  return logSetAdapterEvent
}

export function createLogSetCloseFactorBpsEvent(
  _caller: Address,
  _collateralPoolId: Bytes,
  _closeFactorBps: BigInt
): LogSetCloseFactorBps {
  let logSetCloseFactorBpsEvent = changetype<LogSetCloseFactorBps>(
    newMockEvent()
  )

  logSetCloseFactorBpsEvent.parameters = new Array()

  logSetCloseFactorBpsEvent.parameters.push(
    new ethereum.EventParam("_caller", ethereum.Value.fromAddress(_caller))
  )
  logSetCloseFactorBpsEvent.parameters.push(
    new ethereum.EventParam(
      "_collateralPoolId",
      ethereum.Value.fromFixedBytes(_collateralPoolId)
    )
  )
  logSetCloseFactorBpsEvent.parameters.push(
    new ethereum.EventParam(
      "_closeFactorBps",
      ethereum.Value.fromUnsignedBigInt(_closeFactorBps)
    )
  )

  return logSetCloseFactorBpsEvent
}

export function createLogSetDebtAccumulatedRateEvent(
  _caller: Address,
  _collateralPoolId: Bytes,
  _debtAccumulatedRate: BigInt
): LogSetDebtAccumulatedRate {
  let logSetDebtAccumulatedRateEvent = changetype<LogSetDebtAccumulatedRate>(
    newMockEvent()
  )

  logSetDebtAccumulatedRateEvent.parameters = new Array()

  logSetDebtAccumulatedRateEvent.parameters.push(
    new ethereum.EventParam("_caller", ethereum.Value.fromAddress(_caller))
  )
  logSetDebtAccumulatedRateEvent.parameters.push(
    new ethereum.EventParam(
      "_collateralPoolId",
      ethereum.Value.fromFixedBytes(_collateralPoolId)
    )
  )
  logSetDebtAccumulatedRateEvent.parameters.push(
    new ethereum.EventParam(
      "_debtAccumulatedRate",
      ethereum.Value.fromUnsignedBigInt(_debtAccumulatedRate)
    )
  )

  return logSetDebtAccumulatedRateEvent
}

export function createLogSetDebtCeilingEvent(
  _caller: Address,
  _collateralPoolId: Bytes,
  _debtCeiling: BigInt
): LogSetDebtCeiling {
  let logSetDebtCeilingEvent = changetype<LogSetDebtCeiling>(newMockEvent())

  logSetDebtCeilingEvent.parameters = new Array()

  logSetDebtCeilingEvent.parameters.push(
    new ethereum.EventParam("_caller", ethereum.Value.fromAddress(_caller))
  )
  logSetDebtCeilingEvent.parameters.push(
    new ethereum.EventParam(
      "_collateralPoolId",
      ethereum.Value.fromFixedBytes(_collateralPoolId)
    )
  )
  logSetDebtCeilingEvent.parameters.push(
    new ethereum.EventParam(
      "_debtCeiling",
      ethereum.Value.fromUnsignedBigInt(_debtCeiling)
    )
  )

  return logSetDebtCeilingEvent
}

export function createLogSetDebtFloorEvent(
  _caller: Address,
  _collateralPoolId: Bytes,
  _debtFloor: BigInt
): LogSetDebtFloor {
  let logSetDebtFloorEvent = changetype<LogSetDebtFloor>(newMockEvent())

  logSetDebtFloorEvent.parameters = new Array()

  logSetDebtFloorEvent.parameters.push(
    new ethereum.EventParam("_caller", ethereum.Value.fromAddress(_caller))
  )
  logSetDebtFloorEvent.parameters.push(
    new ethereum.EventParam(
      "_collateralPoolId",
      ethereum.Value.fromFixedBytes(_collateralPoolId)
    )
  )
  logSetDebtFloorEvent.parameters.push(
    new ethereum.EventParam(
      "_debtFloor",
      ethereum.Value.fromUnsignedBigInt(_debtFloor)
    )
  )

  return logSetDebtFloorEvent
}

export function createLogSetLiquidationRatioEvent(
  _caller: Address,
  _poolId: Bytes,
  _data: BigInt
): LogSetLiquidationRatio {
  let logSetLiquidationRatioEvent = changetype<LogSetLiquidationRatio>(
    newMockEvent()
  )

  logSetLiquidationRatioEvent.parameters = new Array()

  logSetLiquidationRatioEvent.parameters.push(
    new ethereum.EventParam("_caller", ethereum.Value.fromAddress(_caller))
  )
  logSetLiquidationRatioEvent.parameters.push(
    new ethereum.EventParam("_poolId", ethereum.Value.fromFixedBytes(_poolId))
  )
  logSetLiquidationRatioEvent.parameters.push(
    new ethereum.EventParam("_data", ethereum.Value.fromUnsignedBigInt(_data))
  )

  return logSetLiquidationRatioEvent
}

export function createLogSetLiquidatorIncentiveBpsEvent(
  _caller: Address,
  _collateralPoolId: Bytes,
  _liquidatorIncentiveBps: BigInt
): LogSetLiquidatorIncentiveBps {
  let logSetLiquidatorIncentiveBpsEvent = changetype<
    LogSetLiquidatorIncentiveBps
  >(newMockEvent())

  logSetLiquidatorIncentiveBpsEvent.parameters = new Array()

  logSetLiquidatorIncentiveBpsEvent.parameters.push(
    new ethereum.EventParam("_caller", ethereum.Value.fromAddress(_caller))
  )
  logSetLiquidatorIncentiveBpsEvent.parameters.push(
    new ethereum.EventParam(
      "_collateralPoolId",
      ethereum.Value.fromFixedBytes(_collateralPoolId)
    )
  )
  logSetLiquidatorIncentiveBpsEvent.parameters.push(
    new ethereum.EventParam(
      "_liquidatorIncentiveBps",
      ethereum.Value.fromUnsignedBigInt(_liquidatorIncentiveBps)
    )
  )

  return logSetLiquidatorIncentiveBpsEvent
}

export function createLogSetPriceFeedEvent(
  _caller: Address,
  _poolId: Bytes,
  _priceFeed: Address
): LogSetPriceFeed {
  let logSetPriceFeedEvent = changetype<LogSetPriceFeed>(newMockEvent())

  logSetPriceFeedEvent.parameters = new Array()

  logSetPriceFeedEvent.parameters.push(
    new ethereum.EventParam("_caller", ethereum.Value.fromAddress(_caller))
  )
  logSetPriceFeedEvent.parameters.push(
    new ethereum.EventParam("_poolId", ethereum.Value.fromFixedBytes(_poolId))
  )
  logSetPriceFeedEvent.parameters.push(
    new ethereum.EventParam(
      "_priceFeed",
      ethereum.Value.fromAddress(_priceFeed)
    )
  )

  return logSetPriceFeedEvent
}

export function createLogSetPriceWithSafetyMarginEvent(
  _caller: Address,
  _collateralPoolId: Bytes,
  _priceWithSafetyMargin: BigInt
): LogSetPriceWithSafetyMargin {
  let logSetPriceWithSafetyMarginEvent = changetype<
    LogSetPriceWithSafetyMargin
  >(newMockEvent())

  logSetPriceWithSafetyMarginEvent.parameters = new Array()

  logSetPriceWithSafetyMarginEvent.parameters.push(
    new ethereum.EventParam("_caller", ethereum.Value.fromAddress(_caller))
  )
  logSetPriceWithSafetyMarginEvent.parameters.push(
    new ethereum.EventParam(
      "_collateralPoolId",
      ethereum.Value.fromFixedBytes(_collateralPoolId)
    )
  )
  logSetPriceWithSafetyMarginEvent.parameters.push(
    new ethereum.EventParam(
      "_priceWithSafetyMargin",
      ethereum.Value.fromUnsignedBigInt(_priceWithSafetyMargin)
    )
  )

  return logSetPriceWithSafetyMarginEvent
}

export function createLogSetStabilityFeeRateEvent(
  _caller: Address,
  _poolId: Bytes,
  _data: BigInt
): LogSetStabilityFeeRate {
  let logSetStabilityFeeRateEvent = changetype<LogSetStabilityFeeRate>(
    newMockEvent()
  )

  logSetStabilityFeeRateEvent.parameters = new Array()

  logSetStabilityFeeRateEvent.parameters.push(
    new ethereum.EventParam("_caller", ethereum.Value.fromAddress(_caller))
  )
  logSetStabilityFeeRateEvent.parameters.push(
    new ethereum.EventParam("_poolId", ethereum.Value.fromFixedBytes(_poolId))
  )
  logSetStabilityFeeRateEvent.parameters.push(
    new ethereum.EventParam("_data", ethereum.Value.fromUnsignedBigInt(_data))
  )

  return logSetStabilityFeeRateEvent
}

export function createLogSetStrategyEvent(
  _caller: Address,
  _collateralPoolId: Bytes,
  strategy: Address
): LogSetStrategy {
  let logSetStrategyEvent = changetype<LogSetStrategy>(newMockEvent())

  logSetStrategyEvent.parameters = new Array()

  logSetStrategyEvent.parameters.push(
    new ethereum.EventParam("_caller", ethereum.Value.fromAddress(_caller))
  )
  logSetStrategyEvent.parameters.push(
    new ethereum.EventParam(
      "_collateralPoolId",
      ethereum.Value.fromFixedBytes(_collateralPoolId)
    )
  )
  logSetStrategyEvent.parameters.push(
    new ethereum.EventParam("strategy", ethereum.Value.fromAddress(strategy))
  )

  return logSetStrategyEvent
}

export function createLogSetTotalDebtShareEvent(
  _caller: Address,
  _collateralPoolId: Bytes,
  _totalDebtShare: BigInt
): LogSetTotalDebtShare {
  let logSetTotalDebtShareEvent = changetype<LogSetTotalDebtShare>(
    newMockEvent()
  )

  logSetTotalDebtShareEvent.parameters = new Array()

  logSetTotalDebtShareEvent.parameters.push(
    new ethereum.EventParam("_caller", ethereum.Value.fromAddress(_caller))
  )
  logSetTotalDebtShareEvent.parameters.push(
    new ethereum.EventParam(
      "_collateralPoolId",
      ethereum.Value.fromFixedBytes(_collateralPoolId)
    )
  )
  logSetTotalDebtShareEvent.parameters.push(
    new ethereum.EventParam(
      "_totalDebtShare",
      ethereum.Value.fromUnsignedBigInt(_totalDebtShare)
    )
  )

  return logSetTotalDebtShareEvent
}

export function createLogSetTreasuryFeesBpsEvent(
  _caller: Address,
  _collateralPoolId: Bytes,
  _treasuryFeeBps: BigInt
): LogSetTreasuryFeesBps {
  let logSetTreasuryFeesBpsEvent = changetype<LogSetTreasuryFeesBps>(
    newMockEvent()
  )

  logSetTreasuryFeesBpsEvent.parameters = new Array()

  logSetTreasuryFeesBpsEvent.parameters.push(
    new ethereum.EventParam("_caller", ethereum.Value.fromAddress(_caller))
  )
  logSetTreasuryFeesBpsEvent.parameters.push(
    new ethereum.EventParam(
      "_collateralPoolId",
      ethereum.Value.fromFixedBytes(_collateralPoolId)
    )
  )
  logSetTreasuryFeesBpsEvent.parameters.push(
    new ethereum.EventParam(
      "_treasuryFeeBps",
      ethereum.Value.fromUnsignedBigInt(_treasuryFeeBps)
    )
  )

  return logSetTreasuryFeesBpsEvent
}

export function createRoleAdminChangedEvent(
  role: Bytes,
  previousAdminRole: Bytes,
  newAdminRole: Bytes
): RoleAdminChanged {
  let roleAdminChangedEvent = changetype<RoleAdminChanged>(newMockEvent())

  roleAdminChangedEvent.parameters = new Array()

  roleAdminChangedEvent.parameters.push(
    new ethereum.EventParam("role", ethereum.Value.fromFixedBytes(role))
  )
  roleAdminChangedEvent.parameters.push(
    new ethereum.EventParam(
      "previousAdminRole",
      ethereum.Value.fromFixedBytes(previousAdminRole)
    )
  )
  roleAdminChangedEvent.parameters.push(
    new ethereum.EventParam(
      "newAdminRole",
      ethereum.Value.fromFixedBytes(newAdminRole)
    )
  )

  return roleAdminChangedEvent
}

export function createRoleGrantedEvent(
  role: Bytes,
  account: Address,
  sender: Address
): RoleGranted {
  let roleGrantedEvent = changetype<RoleGranted>(newMockEvent())

  roleGrantedEvent.parameters = new Array()

  roleGrantedEvent.parameters.push(
    new ethereum.EventParam("role", ethereum.Value.fromFixedBytes(role))
  )
  roleGrantedEvent.parameters.push(
    new ethereum.EventParam("account", ethereum.Value.fromAddress(account))
  )
  roleGrantedEvent.parameters.push(
    new ethereum.EventParam("sender", ethereum.Value.fromAddress(sender))
  )

  return roleGrantedEvent
}

export function createRoleRevokedEvent(
  role: Bytes,
  account: Address,
  sender: Address
): RoleRevoked {
  let roleRevokedEvent = changetype<RoleRevoked>(newMockEvent())

  roleRevokedEvent.parameters = new Array()

  roleRevokedEvent.parameters.push(
    new ethereum.EventParam("role", ethereum.Value.fromFixedBytes(role))
  )
  roleRevokedEvent.parameters.push(
    new ethereum.EventParam("account", ethereum.Value.fromAddress(account))
  )
  roleRevokedEvent.parameters.push(
    new ethereum.EventParam("sender", ethereum.Value.fromAddress(sender))
  )

  return roleRevokedEvent
}
