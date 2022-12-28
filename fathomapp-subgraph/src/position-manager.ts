import {
  LogNewPosition,
  PositionManager,

} from "../generated/PositionManager/PositionManager"
import {CollateralPoolConfig} from "../generated/CollateralPoolConfig/CollateralPoolConfig"
import { Position, Pool, User} from "../generated/schema"
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
    position.collateralPool = poolId
    position.collateralPoolName = poolId.toString()
    position.lockedCollateral = BigDecimal.fromString('0')
    position.debtShare = BigDecimal.fromString('0')
    position.safetyBuffer = BigDecimal.fromString('1')
    position.safetyBufferInPercent = BigDecimal.fromString('0')
    position.tvl = BigDecimal.fromString('0')
    position.positionStatus = 'active'
    position.liquidationPrice = Constants.DEFAULT_PRICE
    position.blockNumber = event.block.number
    position.blockTimestamp = event.block.timestamp
    position.transaction = event.transaction.hash

    position.save()

    //     load user account 
    let user = User.load(event.params._usr.toHexString())

    if(user == null){
      user = new User(event.params._usr.toHexString())  
      user.address = event.params._usr
      user.activePositionsCount = BigInt.fromString('1')
    } else {
      // increment positions count 
      user.activePositionsCount = user.activePositionsCount.plus(BigInt.fromString('1'))
    }
    // save 
    user.save()

    //Save newly opened position in pool
    let pool  = Pool.load(poolId.toHexString())
    if(pool != null){
        let _positions = pool.positions
        _positions.push(positionAddress.toHexString())
        pool.positions = _positions
        pool.save()
    }

}