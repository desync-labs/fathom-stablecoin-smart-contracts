import {
  LogNewPosition,
  PositionManager,

} from "../generated/PositionManager/PositionManager"
import {CollateralPoolConfig} from "../generated/CollateralPoolConfig/CollateralPoolConfig"
import { Position,Pool } from "../generated/schema"
import { log } from '@graphprotocol/graph-ts'


import {
  Address,
  BigDecimal,
  BigInt
} from "@graphprotocol/graph-ts";
import { Constants } from "./Utils/Constants";

export function newPositionHandler(event: LogNewPosition): void {
    let positionManager = PositionManager.bind(Address.fromString(Constants.ADDR_POSITION_MANAGER))
    let positionAddress = positionManager.positions(event.params._positionId)
    let poolId = positionManager.collateralPools(event.params._positionId)

    let position = new Position(positionAddress.toHexString())
    position.positionId = event.params._positionId;
    position.positionAddress = positionAddress;
    position.userAddress = event.params._usr;
    position.walletAddress = event.params._own;
    position.collatralPool = poolId
    position.collatralPoolName = poolId.toString()
    position.lockedCollateral = BigInt.fromString('0')
    position.debtShare = BigInt.fromString('0')
    position.safetyBuffer= BigDecimal.fromString('1')
    position.safetyBufferInPrecent= BigDecimal.fromString('0')
    position.tvl = BigDecimal.fromString('0')
    position.positionStatus = 'active'
    position.liquidtionPrice = Constants.DEFAULT_PRICE
    position.save()

    //Save newly opened position in pool
    let pool  = Pool.load(poolId.toHexString())
    if(pool != null){
        let _positions = pool.positions
        _positions.push(positionAddress.toHexString())
        pool.positions = _positions
        pool.save()
    }

}