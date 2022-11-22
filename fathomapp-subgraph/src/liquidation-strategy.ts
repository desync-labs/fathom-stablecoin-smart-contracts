//
import {LogFixedSpreadLiquidate} from '../generated/FixedSpreadLiquidationStrategy/FixedSpreadLiquidationStrategy'
import { Position } from '../generated/schema'

export function positionLiquidationHandler(
    event: LogFixedSpreadLiquidate
  ): void {
    let position = Position.load(event.params._positionAddress.toHexString())
    if(position!=null){
        position.positionStatus = 'liquidated'
        position.save()
    }
  }