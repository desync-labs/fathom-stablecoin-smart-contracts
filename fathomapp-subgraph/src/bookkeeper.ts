import { BigDecimal, BigInt, log } from "@graphprotocol/graph-ts"
import {LogAdjustPosition, LogSetTotalDebtCeiling, stablecoinIssuedAmount} from "../generated/BookKeeper/BookKeeper"
import {Pool, ProtocolStat,Position } from "../generated/schema"
import { Constants } from "./Utils/Constants"

export function adjustPositionHandler(
    event: LogAdjustPosition
  ): void {

    let poolId = event.params._collateralPoolId
    let pool  = Pool.load(poolId.toHexString())
    if(pool != null){
        pool.lockedCollatral = pool.lockedCollatral.plus(event.params._addCollateral.div(Constants.WAD))
        pool.totalAvailable = pool.debtCeiling.minus(pool.totalBorrowed)
        pool.tvl = pool.lockedCollatral.toBigDecimal().times(pool.collatralPrice)
        pool.save()
    }  


    // Update the total TVL in protcol by adding the TVLs from all pools
    let stats  = ProtocolStat.load(Constants.FATHOM_STATS_KEY)
    let aggregatedTVL = BigDecimal.fromString('0')
    if(stats != null){
      for (let i = 0; i < stats.pools.length; ++i) {
        let pool  = Pool.load(stats.pools[i])
        if (pool != null){
          aggregatedTVL = aggregatedTVL.plus(pool.tvl)
        }
      }

      stats.tvl = aggregatedTVL
      stats.save()
    }  

    //update the positions
    let position = Position.load(event.params._positionAddress.toHexString())
    if(position!=null && pool!=null){
        position.lockedCollateral =  event.params._lockedCollateral.div(Constants.WAD)
        position.debtShare =  Constants.divByRAD(event.params._positionDebtValue)
        position.tvl = position.lockedCollateral.toBigDecimal().times(pool.collatralPrice)
        if(event.params._debtShare.equals(BigInt.fromI32(0))){
          position.positionStatus = 'closed'
        }

        //Update the liquidation price
        //TODO: Can we put this calculationin smart contracts
        if(pool.priceWithSafetyMargin.gt(BigDecimal.fromString('0'))){
           let collatralAvailableToWithdraw = (
                                                pool.priceWithSafetyMargin.times(
                                                    position.lockedCollateral.toBigDecimal()).minus(position.debtShare.toBigDecimal())
                                                )
                                                .div(pool.priceWithSafetyMargin)
                                                
           position.liquidtionPrice = pool.collatralPrice.minus(
                                          (
                                            collatralAvailableToWithdraw.times(pool.priceWithSafetyMargin))
                                            .div(position.lockedCollateral.toBigDecimal()
                                          )
                                        )

            position.safetyBufferInPrecent = collatralAvailableToWithdraw.div(position.lockedCollateral.toBigDecimal())
        }

        position.save()
    } 
  }

  export function setTotalDebtCeilingHanlder(
    event: LogSetTotalDebtCeiling
  ): void {
    let protocolStat  = ProtocolStat.load(Constants.FATHOM_STATS_KEY)
    if(protocolStat == null){
        protocolStat = new ProtocolStat(Constants.FATHOM_STATS_KEY)
        protocolStat.tvl = BigDecimal.fromString('0')
        protocolStat.pools = []
        protocolStat.totalSupply = BigInt.fromI32(0)
    }else{
      protocolStat.totalSupply = Constants.divByRAD(event.params._totalDebtCeiling)
    }
    protocolStat.save()

  }

  export function stablecoinIssuedAmountHandler(
    event: stablecoinIssuedAmount
  ): void {
    let poolId = event.params._collateralPoolId
    let pool  = Pool.load(poolId.toHexString())
    if(pool != null){
      pool.totalBorrowed =  Constants.divByRAD(event.params._poolStablecoinIssued)
      pool.totalAvailable = pool.debtCeiling.minus(pool.totalBorrowed)
      pool.save()
    }
  }