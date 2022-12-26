import { BigDecimal, BigInt } from "@graphprotocol/graph-ts"

export class Constants{
    public static FATHOM_STATS_KEY:string = 'fathom_stats'
    public static DEFAULT_PRICE:BigDecimal = BigDecimal.fromString('0')

    public static ADDR_COLLATERAL_POOL_CONFIG:string = '0xf004fF88E6272dAFf8d062124e30021CD9e5250F'
    public static ADDR_POSITION_MANAGER:string = '0xfeFDf4Cb104BC272Ba0602f4588438551e7067F6'

    public static WAD:BigInt = BigInt.fromI64(10**18)
    public static RAY:BigInt = BigInt.fromI64( 10**27)
    public static RAD:BigInt = BigInt.fromI64( 10**45)

    public  static divByRAY(number: BigInt): BigInt {
        return number.div(Constants.WAD).div(BigInt.fromI64(10**9))
    }

    public  static divByRAYToDecimal(number: BigInt): BigDecimal {
        return number.toBigDecimal().div(Constants.WAD.toBigDecimal()).div(BigInt.fromI64(10**9).toBigDecimal())
    }

    public  static divByRAD(number: BigInt): BigInt {
        return number.div(Constants.WAD).div(Constants.WAD).div(BigInt.fromI64(10**9))
    }

    public  static divByRADToDecimal(number: BigInt): BigDecimal {
        return number.toBigDecimal().div(Constants.WAD.toBigDecimal()).div(Constants.WAD.toBigDecimal()).div(BigInt.fromI64(10**9).toBigDecimal())
    }
}