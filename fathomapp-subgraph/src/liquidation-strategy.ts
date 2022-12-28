import { BigInt, log } from "@graphprotocol/graph-ts"
import {LogFixedSpreadLiquidate} from '../generated/FixedSpreadLiquidationStrategy/FixedSpreadLiquidationStrategy'
import { Position, User } from '../generated/schema'

export function positionLiquidationHandler(
    event: LogFixedSpreadLiquidate
  ): void {
    let position = Position.load(event.params._positionAddress.toHexString().toLowerCase())
    if(position!=null){
        position.positionStatus = 'liquidated'
        position.save()

        // decrement user position count
        let user = User.load(position.userAddress.toHexString())
        if (user != null) {
          user.activePositionsCount = user.activePositionsCount.minus(BigInt.fromString('1'))
          user.save()
        }
    }
  }