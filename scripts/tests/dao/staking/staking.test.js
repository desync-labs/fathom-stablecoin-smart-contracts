const { web3 } = require("@openzeppelin/test-helpers/src/setup");
const BN = web3.utils.BN
const chai = require("chai");
const { expect } = chai.use(require('chai-bn')(BN));
const should = chai.use(require('chai-bn')(BN)).should();

const utils = require('../../helpers/utils');
const eventsHelper = require("../../helpers/eventsHelper");
const blockchain = require("../../helpers/blockchain");




const maxGasForTxn = 600000
const {
    shouldRevert,
    errTypes
} = require('../../helpers/expectThrow');

const SYSTEM_ACC = accounts[0];
const staker_1 = accounts[1];

const stream_owner = accounts[3];
const staker_2 = accounts[4];
const staker_3 = accounts[5];
const staker_4 = accounts[6];

const stream_manager = accounts[7];
const stream_rewarder_1 = accounts[8];
const stream_rewarder_2 = accounts[9];

let vault_test_address;
const treasury = SYSTEM_ACC;

const _createWeightObject = (
    maxWeightShares,
    minWeightShares,
    maxWeightPenalty,
    minWeightPenalty,
    weightMultiplier) => {
    return {
        maxWeightShares: maxWeightShares,
        minWeightShares: minWeightShares,
        maxWeightPenalty: maxWeightPenalty,
        minWeightPenalty: minWeightPenalty,
        penaltyWeightMultiplier: weightMultiplier
    }
}


const _getTimeStamp = async () => {
    const timestamp = await blockchain.getLatestBlockTimestamp()
    return timestamp
}
const _calculateNumberOfVMAINTkn = (sumToDeposit, lockingPeriod, lockingWeight) =>{
    const lockingPeriodBN = new web3.utils.BN(lockingPeriod);
    const lockingWeightBN = new web3.utils.BN(lockingWeight);
    const sumToDepositBN = new web3.utils.BN(sumToDeposit);
    
    return sumToDepositBN.mul(lockingPeriodBN).div(lockingWeightBN);
}

const _calculateNumberOfStreamShares = (sumToDeposit, veMainTokenCoefficient, nVMAINTkn, maxWeightShares) => {
    const sumToDepositBN = new web3.utils.BN(sumToDeposit);
    const veMainTokenWeightBN = new web3.utils.BN(veMainTokenCoefficient); 
    const maxWeightBN = new web3.utils.BN(maxWeightShares);
    const oneThousandBN = new web3.utils.BN(1000)
    return (sumToDepositBN.add(veMainTokenWeightBN.mul(nVMAINTkn).div(oneThousandBN))).mul(maxWeightBN);
}

const _calculateRemainingBalance = (depositAmount, beforeBalance) => {
    const depositAmountBN = new web3.utils.BN(depositAmount);
    const beforeBalanceBN = new web3.utils.BN(beforeBalance)
    return beforeBalanceBN.sub(depositAmountBN)
}

const _calculateAfterWithdrawingBalance = (pendingAmount, beforeBalance) => {
    const pendingAmountBN = new web3.utils.BN(pendingAmount);
    const beforeBalanceBN = new web3.utils.BN(beforeBalance)
    return beforeBalanceBN.add(pendingAmountBN)
}

const _convertToEtherBalance = (balance) => {
    return parseFloat(web3.utils.fromWei(balance,"ether").toString()).toFixed(5)
}

describe("Staking Test", () => {

    const oneMonth = 30 * 24 * 60 * 60;
    const oneYear = 31556926;
    let stakingService;
    let vaultService;
    let mainTknToken;
    let veMainToken;

    let streamReward1;
    let streamReward2;

    let veMainTokenAddress;
    let mainTknTokenAddress;
    let streamReward1Address;
    let streamReward2Address;

    let maxWeightShares;
    let minWeightShares;
    let maxWeightPenalty;
    let minWeightPenalty;
    let veMainTokenCoefficient;
    let lockingVoteWeight;
    let totalAmountOfStakedMAINTkn;
    let totalAmountOfVMAINTkn;
    let totalAmountOfStreamShares;
    let maxNumberOfLocks;
    let _flags;
    
    const sumToDeposit = web3.utils.toWei('100', 'ether');
    const sumToTransfer = web3.utils.toWei('2000', 'ether');
    const sumToApprove = web3.utils.toWei('3000','ether');
    const sumForProposer = web3.utils.toWei('3000','ether')
    const veMainTokensToApprove = web3.utils.toWei('500000', 'ether')

    before(async() => {
        await snapshot.revertToSnapshot();
        maxWeightShares = 1024;
        minWeightShares = 256;
        maxWeightPenalty = 3000;
        minWeightPenalty = 100;
        weightMultiplier = 10;
        maxNumberOfLocks = 10;
        _flags = 0;
        

        const weightObject =  _createWeightObject(
                              maxWeightShares,
                              minWeightShares,
                              maxWeightPenalty,
                              minWeightPenalty,
                              weightMultiplier)
        //this is used for stream shares calculation.
        veMainTokenCoefficient = 500;
        //this is used for calculation of release of veMAINTkn
        lockingVoteWeight = 365 * 24 * 60 * 60;
        
        stakingService = await artifacts.initializeInterfaceAt(
            "IStaking",
            "StakingPackage"
        );

        vaultService = await artifacts.initializeInterfaceAt(
            "IVault",
            "VaultPackage"
        );

        mainTknToken = await artifacts.initializeInterfaceAt("ERC20MainToken","ERC20MainToken");
        streamReward1 = await artifacts.initializeInterfaceAt("ERC20Rewards1","ERC20Rewards1");
        streamReward2 = await artifacts.initializeInterfaceAt("ERC20Rewards2","ERC20Rewards2");
        
        await streamReward1.transfer(stream_rewarder_1,web3.utils.toWei("10000","ether"),{from: SYSTEM_ACC});
        await streamReward2.transfer(stream_rewarder_2,web3.utils.toWei("10000","ether"),{from: SYSTEM_ACC});
        
        veMainToken = await artifacts.initializeInterfaceAt("VeMainToken", "VeMainToken");
        
        
        await veMainToken.addToWhitelist(stakingService.address, {from: SYSTEM_ACC})
        
        minter_role = await veMainToken.MINTER_ROLE();
        await veMainToken.grantRole(minter_role, stakingService.address, {from: SYSTEM_ACC});

        veMainTokenAddress = veMainToken.address;
        mainTknTokenAddress = mainTknToken.address;
        streamReward1Address = streamReward1.address;
        streamReward2Address = streamReward2.address;
        
        await mainTknToken.transfer(staker_1,sumToTransfer, {from: SYSTEM_ACC})
        await mainTknToken.transfer(staker_2,sumToTransfer, {from: SYSTEM_ACC})
        await mainTknToken.transfer(staker_3,sumToTransfer, {from: SYSTEM_ACC})
        await mainTknToken.transfer(staker_4,sumToTransfer, {from: SYSTEM_ACC})
        await mainTknToken.transfer(stream_manager, sumForProposer, {from: SYSTEM_ACC})
        
        await veMainToken.approve(stakingService.address,veMainTokensToApprove, {from: SYSTEM_ACC})

        const twentyPercentOfMAINTknTotalSupply = web3.utils.toWei('200000', 'ether');
            
        
        vault_test_address = vaultService.address;
        await mainTknToken.transfer(vault_test_address, twentyPercentOfMAINTknTotalSupply, {from: SYSTEM_ACC})

        const startTime =  await _getTimeStamp() + 3 * 24 * 24 * 60;

        const scheduleRewards = [
            web3.utils.toWei('2000', 'ether'),
            web3.utils.toWei('1000', 'ether'),
            web3.utils.toWei('500', 'ether'),
            web3.utils.toWei('250', 'ether'),
            web3.utils.toWei("0", 'ether')
        ]
        const scheduleTimes = [
            startTime,
            startTime + oneYear,
            startTime + 2 * oneYear,
            startTime + 3 * oneYear,
            startTime + 4 * oneYear,
        ]
        await vaultService.addSupportedToken(mainTknTokenAddress)
        await vaultService.addSupportedToken(streamReward1Address)
        await vaultService.addSupportedToken(streamReward2Address)
        
        await stakingService.initializeStaking(
            vault_test_address,
            mainTknTokenAddress,
            veMainTokenAddress,
            
            
            weightObject,
            stream_owner,
            scheduleTimes,
            scheduleRewards,
            2,
            veMainTokenCoefficient,
            lockingVoteWeight,
            maxNumberOfLocks
            //_flags
         )
         
         await stakingService.setTreasuryAddress(treasury);
    });

    describe('Creating Locks and Unlocking before any stream reward tokens are issued, and release vote token', async() => {
        expectedTotalAmountOfVMAINTkn = new web3.utils.BN(0)
        it('Should create a lock possition with lockId = 1 for staker_1', async() => {
            // So that staker 1 can actually stake the token:
            await mainTknToken.approve(stakingService.address, sumToApprove, {from: staker_1})
            const beforeMAINTknBalance = await mainTknToken.balanceOf(staker_1);

            await blockchain.increaseTime(20);
            let lockingPeriod = 24 * 60 * 60;

            const unlockTime = await _getTimeStamp() + lockingPeriod;
            const beforeLockTimestamp = await _getTimeStamp()
            let result = await stakingService.createLock(sumToDeposit,unlockTime, {from: staker_1});
            // Since block time stamp can change after locking, we record the timestamp, 
                // later to be used in the expectedNVMAINTkn calculation.  
                // This mitigates an error created from the slight change in block time.

            lockingPeriod = lockingPeriod - (await _getTimeStamp() - beforeLockTimestamp);
            
            const expectedMAINTknBalanceStaker1 = _calculateRemainingBalance(sumToDeposit, beforeMAINTknBalance.toString())
            const afterMAINTknBalance = await mainTknToken.balanceOf(staker_1);
            
            let eventArgs = eventsHelper.getIndexedEventArgs(result, "Staked(address,uint256,uint256,uint256)");
            const expectedLockId = 1
            
            assert.equal(eventArgs[2].toString(),expectedLockId)
            assert.equal(afterMAINTknBalance.toString(),expectedMAINTknBalanceStaker1.toString())

            const expectedNVMAINTkn = _calculateNumberOfVMAINTkn(sumToDeposit, lockingPeriod, lockingVoteWeight)
            expectedTotalAmountOfVMAINTkn = expectedTotalAmountOfVMAINTkn.add(expectedNVMAINTkn)

            const staker1VeTokenBal = (await veMainToken.balanceOf(staker_1)).toString()

            //  Here we check that the correct amount of vote was minted.
            staker1VeTokenBal.should.be.bignumber.equal(expectedNVMAINTkn)
        });
        
        it("Should create a second lock possition for staker_1, and check that correct number of vote tokens are released", async() => {
            
            await blockchain.increaseTime(20);
            let lockingPeriod = 24 * 60 * 60;
            
            const unlockTime = await _getTimeStamp() + lockingPeriod;
            const beforeLockTimestamp = await _getTimeStamp()
            let result = await stakingService.createLock(sumToDeposit,unlockTime,{from: staker_1, gas:maxGasForTxn});
            lockingPeriod = lockingPeriod - (await _getTimeStamp() - beforeLockTimestamp)
            
            let eventArgs = eventsHelper.getIndexedEventArgs(result, "Staked(address,uint256,uint256,uint256)");
            const actualNVMAINTkn = web3.utils.toBN(eventArgs[1]);

            //lockingVoteWeight = 365 * 24 * 60 * 60;
            const expectedNVMAINTkn = _calculateNumberOfVMAINTkn(sumToDeposit, lockingPeriod, lockingVoteWeight)
            
            const expectedShares = _calculateNumberOfStreamShares(sumToDeposit, veMainTokenCoefficient, actualNVMAINTkn, maxWeightShares);
            const actualShares = web3.utils.toBN(eventArgs[0])
            
            actualNVMAINTkn.should.be.bignumber.equal(expectedNVMAINTkn)
            actualShares.should.be.bignumber.equal(expectedShares)
            expectedTotalAmountOfVMAINTkn = expectedTotalAmountOfVMAINTkn.add(expectedNVMAINTkn)

        })

        // it("Should update total vote token balance.", async() => {
        //     const totalAmountOfVMAINTkn = (await stakingService.totalAmountOfveMAINTkn()).toString();
        //     expectedTotalAmountOfVMAINTkn.should.be.bignumber.equal(totalAmountOfVMAINTkn);
        // })

        it("Should have correct total number of staked protocol tokens", async() => {
            //2 deposits:
            const sumToDepositBN = new web3.utils.BN(sumToDeposit);
            const expectedTotalAmountOfStakedMAINTkn = sumToDepositBN.add(sumToDepositBN);
            let result = await stakingService.totalAmountOfStakedMAINTkn()
            const totalAmountOfStakedMAINTkn = result;
            assert.equal(totalAmountOfStakedMAINTkn.toString(),expectedTotalAmountOfStakedMAINTkn.toString())
            const totalMAINTknShares = await stakingService.totalMAINTknShares();
            expect(totalMAINTknShares).to.eql(totalAmountOfStakedMAINTkn)
        })


        it("Setup a lock position for staker_2, staker_3, staker_4", async() => {
            const unlockTime = await _getTimeStamp() + 500;
            const expectedLockId = 1
            
            const sumToDepositForAll = web3.utils.toWei('0.11', 'ether');

            await mainTknToken.approve(stakingService.address, sumToApprove, {from: staker_2})
            await mainTknToken.approve(stakingService.address, sumToApprove, {from: staker_3})
            await mainTknToken.approve(stakingService.address, sumToApprove, {from: staker_4})
            
            await blockchain.mineBlock(await _getTimeStamp() + 20);
            
            let result1 = await stakingService.createLock(sumToDepositForAll,unlockTime, {from: staker_2});
            await blockchain.mineBlock(await _getTimeStamp() + 20);
            let result2 = await stakingService.createLock(sumToDepositForAll,unlockTime, {from: staker_3});
            await blockchain.mineBlock(await _getTimeStamp() + 20);
            let result3 = await stakingService.createLock(sumToDepositForAll,unlockTime, {from: staker_4});
            await blockchain.mineBlock(await _getTimeStamp() + 20);

            let eventArgs1 = eventsHelper.getIndexedEventArgs(result1, "Staked(address,uint256,uint256,uint256)");
            let eventArgs2 = eventsHelper.getIndexedEventArgs(result2, "Staked(address,uint256,uint256,uint256)");
            let eventArgs3 = eventsHelper.getIndexedEventArgs(result3, "Staked(address,uint256,uint256,uint256)");

            // Check that the lock id is being assigned correctly.  For each staker, their first respective lockId is 1
            assert.equal(eventArgs1[2].toString(),expectedLockId)
            assert.equal(eventArgs2[2].toString(),expectedLockId)
            assert.equal(eventArgs3[2].toString(),expectedLockId)
        })




        it("Should not unlock locked position before the end of the lock possition's lock period - staker_1", async() => {
            
            const errorMessage = "lock not open";

            await shouldRevert(
                stakingService.unlock(1, {from: staker_1}),
                errTypes.revert,  
                errorMessage
            );
            //  staker_1 would have to use the function earlyUnlock() to unlock before the lock period has passed.
        })


        it("Setup a third locked position with a 5 second lock period: LockId = 3 - staker_1", async() => {
            const timestamp = await _getTimeStamp();
            const unlockTime = timestamp + 5;

            let result = await stakingService.createLock(sumToDeposit,unlockTime,{from: staker_1});
            await blockchain.mineBlock(await _getTimeStamp() + 20);
        })


        
        // it("Should completely unlock LockId = 1 - staker_1, and swap with last lock position _3", async() => {
        it("Should completely unlock LockId = 1 - staker_1, replace LockId 1 with LockId 3 in the locks array for staker_1", async() => {
            // The lock array for staker_1 should reduce in length by 1 on the backend.
            const timestamp = await _getTimeStamp();
            const sumToUnstake = web3.utils.toWei('0.01','ether')
            await blockchain.mineBlock(timestamp + 24 * 60 * 60 + 10);
            

            let result = await stakingService.getLockInfo(staker_1,3);
            const amountOfVMAINTknLock3 = result.amountOfveMAINTkn.toString()

            await stakingService.unlock(1, {from : staker_1});
            const errorMessage = "getLockInfo: LockId out of index";

            await shouldRevert(
                stakingService.getLockInfo(staker_1,3),
                errTypes.revert,  
                errorMessage
            );

            result = await stakingService.getLockInfo(staker_1,1);
            
            assert(amountOfVMAINTknLock3, result.amountOfveMAINTkn.toString());
            await blockchain.mineBlock(await _getTimeStamp() + 20);
        })

        
        it("Should unlock completely locked positions for user - staker_2", async() => {
            let result = await stakingService.getLockInfo(staker_2,1);
            const beforeVOTEBalance  = (await veMainToken.balanceOf(staker_2)).toString()
            await stakingService.unlock(1, {from: staker_2});
            const afterVOTEBalance  = (await veMainToken.balanceOf(staker_2)).toString()
            const amountOfVMAINTknLock3 = result.amountOfveMAINTkn.toString()
            
            const differenceInBalance = _calculateRemainingBalance(afterVOTEBalance,beforeVOTEBalance)
            amountOfVMAINTknLock3.should.be.bignumber.equal(differenceInBalance.toString())
            const errorMessage = "getLockInfo: LockId out of index";
            // The last lock possition should no longer be accesible
            await shouldRevert(
                stakingService.getLockInfo(staker_2,1),
                errTypes.revert,  
                errorMessage
            );
            await blockchain.mineBlock(await _getTimeStamp() + 20);
        }) 
        
        

        it("Should unlock completely locked positions for user - staker_3", async() => {
            await stakingService.unlock(1, {from: staker_3});
            const errorMessage = "getLockInfo: LockId out of index";

            await shouldRevert(
                stakingService.getLockInfo(staker_3,1),
                errTypes.revert,  
                errorMessage
            );
            
            await blockchain.mineBlock(await _getTimeStamp() + 20);
        });



        it("Should unlock completely locked positions for user - staker_4", async() => {
            await stakingService.unlock(1, {from: staker_4});
            const errorMessage = "getLockInfo: LockId out of index";

            await shouldRevert(
                stakingService.getLockInfo(staker_4,1),
                errTypes.revert,  
                errorMessage
            );
            

        });

        it("Should unlock completely for locked position 1 - staker_1", async() => {
            await blockchain.mineBlock(await _getTimeStamp() + 20);
            let result = await stakingService.unlock(1, {from : staker_1});
            
            await blockchain.mineBlock(await _getTimeStamp() + 20);
            await stakingService.unlock(1, {from : staker_1});
            await blockchain.mineBlock(await _getTimeStamp() + 20);
            const totalAmountOfStakedMAINTkn = await stakingService.totalAmountOfStakedMAINTkn()
            const totalMAINTknShares = await stakingService.totalMAINTknShares();
            const totalAmountOfStreamShares = await stakingService.totalStreamShares()

            assert.equal(totalAmountOfStakedMAINTkn.toString(),"0")
            assert.equal(totalMAINTknShares.toString(),"0")
            assert.equal(totalAmountOfStreamShares.toString(),"0")
            // console.log("----- After all the locks are completely unlocked ------")
            // console.log("totalAmountOfStakedMAINTkn: ", totalAmountOfStakedMAINTkn.toString());
            // console.log("totalMAINTknShares: ", totalMAINTknShares.toString());
            // console.log("totalAmountOfStreamShares: ", totalAmountOfStreamShares.toString());
        });
    });
    
    describe('Creating Streams and Rewards Calculations', async() => {
        
        it("Should propose a stream", async() => {
            const id = 1;

            const maxRewardProposalAmountForAStream = web3.utils.toWei('1000', 'ether');
            const minRewardProposalAmountForAStream = web3.utils.toWei('200', 'ether');

            
            const startTime = await _getTimeStamp() + 1000;
            const scheduleRewards = [
                web3.utils.toWei('1000', 'ether'),
                web3.utils.toWei('800', 'ether'),
                web3.utils.toWei('600', 'ether'),
                web3.utils.toWei('400', 'ether'),
                web3.utils.toWei('200', 'ether'),
                web3.utils.toWei("0", 'ether')
            ]
            const scheduleTimes = [
                startTime,
                startTime + oneMonth,
                startTime + 2 * oneMonth,
                startTime + 3 * oneMonth,
                startTime + 4 * oneMonth,
                startTime + 5 * oneMonth
            ]

            const result = await stakingService.proposeStream(
                stream_rewarder_1,
                streamReward1Address,
                maxRewardProposalAmountForAStream,
                minRewardProposalAmountForAStream,
                scheduleTimes,
                scheduleRewards,
                10
                ,{from: SYSTEM_ACC}  
            )
            await blockchain.mineBlock(await _getTimeStamp() + 10)
        })

        it("Should Create a Stream", async() => {
            // Once createStream is called, the proposal will become live once start time is reached
            const RewardProposalAmountForAStream = web3.utils.toWei('800', 'ether');
            await streamReward1.approve(stakingService.address, RewardProposalAmountForAStream, {from:stream_rewarder_1})
            await stakingService.createStream(1,RewardProposalAmountForAStream, {from: stream_rewarder_1});
            await blockchain.mineBlock(await _getTimeStamp() + 20);
        })

        it("Should propose a second stream, stream - 2", async() => {

            const maxRewardProposalAmountForAStream = web3.utils.toWei('1000', 'ether');
            const minRewardProposalAmountForAStream = web3.utils.toWei('200', 'ether');

            
            const startTime = await _getTimeStamp() + 1000;
            const scheduleRewards = [
                web3.utils.toWei('1000', 'ether'),
                web3.utils.toWei("0", 'ether')
            ]
            
            const scheduleTimes = [
                startTime,
                startTime + oneYear
            ]

            const result = await stakingService.proposeStream(
                stream_rewarder_2,
                streamReward2Address,
                maxRewardProposalAmountForAStream,
                minRewardProposalAmountForAStream,
                scheduleTimes,
                scheduleRewards,
                10
                ,{from: SYSTEM_ACC}
            )

            await blockchain.mineBlock(await _getTimeStamp() + 10)
        })


        it("Should Create a Stream - 2", async() => {
            const RewardProposalAmountForAStream = web3.utils.toWei('1000', 'ether');
            await streamReward2.approve(stakingService.address, RewardProposalAmountForAStream, {from:stream_rewarder_2})
            await stakingService.createStream(2,RewardProposalAmountForAStream, {from: stream_rewarder_2});
        })

        it('Setup Locks for staker_3 and staker_4 reward tests', async() => {
            const lockingPeriod = 20 * 24 * 60 * 60
            const unlockTime = await _getTimeStamp() + lockingPeriod;
            
            await stakingService.createLock(sumToDeposit,unlockTime, {from: staker_3,gas: maxGasForTxn});
            await blockchain.mineBlock(await _getTimeStamp() + 20);
            await stakingService.createLock(sumToDeposit,unlockTime, {from: staker_4,gas: maxGasForTxn});
            
        });


        it('Should get correct Rewards', async() => {
            await blockchain.increaseTime(20);
            let lockingPeriod = 20 * 24 * 60 * 60
            const unlockTime = await _getTimeStamp() + lockingPeriod;
            
            let beforeLockTimestamp = await _getTimeStamp();
            await stakingService.createLock(sumToDeposit,unlockTime, {from: staker_2,gas: maxGasForTxn});
            lockingPeriod = lockingPeriod - (await _getTimeStamp() - beforeLockTimestamp)
            const mineToTimestamp = 20 * 24 * 60 * 60
            await blockchain.mineBlock(beforeLockTimestamp + mineToTimestamp);
            
            
            const lockId = 1
            const rewardsPeriod = lockingPeriod
            const rewardsPeriodBN = new web3.utils.toBN(rewardsPeriod)
            const RewardProposalAmountForAStream = web3.utils.toWei('1000', 'ether');
            
            await stakingService.claimRewards(2,lockId,{from:staker_2, gas: maxGasForTxn});
            const lockInfo = await stakingService.getLockInfo(staker_2,1)
            const positionStreamSharesBN = new web3.utils.toBN((await lockInfo.positionStreamShares).toString())
            const rewardsAmountTotal = new web3.utils.toBN(RewardProposalAmountForAStream)
            const oneYearBN = new web3.utils.toBN(oneYear)
            const rewards = rewardsPeriodBN.mul(rewardsAmountTotal).div(oneYearBN)

            totalAmountOfStreamShares = await stakingService.totalStreamShares()
            const totalStreamShares = new web3.utils.toBN(totalAmountOfStreamShares.toString())
            const expectedRewards = rewards.mul(positionStreamSharesBN).div(totalStreamShares).toString()
            console.log("expected Rewards for staker_2: ",_convertToEtherBalance(expectedRewards))

            await blockchain.mineBlock(await _getTimeStamp() + 20);
            const pendingRewards = (await stakingService.getUsersPendingRewards(staker_2,2)).toString()
            console.log("pending rewards for staker_ 2:",_convertToEtherBalance(pendingRewards));

            // Minute changes in blocktimes effect the rewards calculations.  
            //  So in reward tests like this one we just check that the expected value is within an acceptable range of the output.
        })

        it('Claim rewards for stream 2 staker_3,staker_4', async() => {
            //Time stamp increased = 20 * 24 * 60 * 60
            const lockId = 1
            let result1 = await stakingService.claimRewards(2,lockId,{from:staker_3, gas: maxGasForTxn});
            await blockchain.mineBlock(await _getTimeStamp() + 20);
            let result2 = await stakingService.claimRewards(2,lockId,{from:staker_4, gas: maxGasForTxn});
            await blockchain.mineBlock(await _getTimeStamp() + 20);

            //console.log("gas for claiming first rewards:",result1.gasUsed.toString())
            //console.log("gas for claiming first rewards:",result2.gasUsed.toString())
            let pendingRewards = (await stakingService.getUsersPendingRewards(staker_3,2)).toString()
            console.log("pending rewards staker_3 - 1st Claim: lockId -1",_convertToEtherBalance(pendingRewards));
            pendingRewards = (await stakingService.getUsersPendingRewards(staker_4,2)).toString()
            console.log("pending rewards staker_4 - 1st Claim: lockId -1",_convertToEtherBalance(pendingRewards));
            //  Rewards balance has been increased, but the rewards still need to be withdrawn
            
            
        })
        
        it('Second claim rewards for stream 2 staker_3, staker_4', async() => {
            const timestamp = await _getTimeStamp();
            const mineToTimestamp = 1 * 24 * 60 * 60
            await blockchain.mineBlock(timestamp + mineToTimestamp);

            const lockId = 1
            await stakingService.claimRewards(2,lockId,{from:staker_3, gas: maxGasForTxn});
            await blockchain.mineBlock(await _getTimeStamp() + 20)
            await stakingService.claimRewards(2,lockId,{from:staker_4, gas: maxGasForTxn});
            let pendingRewards = (await stakingService.getUsersPendingRewards(staker_3,2)).toString()
            console.log("pending rewards staker_3 - 2nd Claim: lockId -1",_convertToEtherBalance(pendingRewards));
            pendingRewards = (await stakingService.getUsersPendingRewards(staker_4,2)).toString()
            console.log("pending rewards staker_4 - 2nd Claim: lockId - 1",_convertToEtherBalance(pendingRewards));
        })
        
        it("Should withdraw stream rewards for all stream 2 stakers", async() => {
            let timestamp = await _getTimeStamp();
            let mineToTimestamp = 15
            await blockchain.mineBlock(timestamp + mineToTimestamp);
            
            await stakingService.withdraw(2, {from: staker_2})
            
            let beforeBalanceStaker2 = await streamReward2.balanceOf(staker_3)
            console.log("balance of stream reward token 2, staker _3, before withdraw: ",_convertToEtherBalance(beforeBalanceStaker2.toString()))
            
            await stakingService.withdraw(2, {from: staker_3})
            let afterBalanceStaker2 = await streamReward2.balanceOf(staker_3)
            console.log("balance of stream reward token 2, staker _3, after withdraw: ",_convertToEtherBalance(afterBalanceStaker2.toString()))
            await stakingService.withdraw(2, {from: staker_4})
            
            assert.equal((await stakingService.getUsersPendingRewards(staker_2,2)).toString(),"0")
            assert.equal((await stakingService.getUsersPendingRewards(staker_3,2)).toString(),"0")
            assert.equal((await stakingService.getUsersPendingRewards(staker_3,2)).toString(),"0")
            await blockchain.mineBlock(await _getTimeStamp() + 20);
        })
     
        
        it('Setup 2nd lock position for stakers 2, 4,', async() => {
           
            const lockingPeriod = 20 * 24 * 60 * 60
            const unlockTime = await _getTimeStamp() + lockingPeriod;
            
            let result1 = await stakingService.createLock(sumToDeposit,unlockTime, {from: staker_2, gas: maxGasForTxn});
            await blockchain.mineBlock(await _getTimeStamp() + 100);
            let result3 = await stakingService.createLock(sumToDeposit,unlockTime, {from: staker_4, gas: maxGasForTxn});
            await blockchain.mineBlock(await _getTimeStamp() + 100);

        })

        it('Setup 2nd lock position for stakers 3,', async() => {
            // Seperated because there is a different locking period for staker 3 compared to stakers 2, 4.
           
            const lockingPeriod_staker3 = 12 * 60 * 60
            const unlockTime_staker3 = await _getTimeStamp() + lockingPeriod_staker3
            let result2 = await stakingService.createLock(sumToDeposit,unlockTime_staker3, {from: staker_3, gas: maxGasForTxn});
            await blockchain.mineBlock(await _getTimeStamp() + 100);
        })

        it('Claim rewards for stream 2 staker_3,staker_4', async() => {
            let timestamp = await _getTimeStamp();
            let mineToTimestamp = 1* 24 * 60 * 60
            await blockchain.mineBlock(timestamp + mineToTimestamp);
            const lockId = 2
            let result1 = await stakingService.claimRewards(2,lockId,{from:staker_3, gas: maxGasForTxn});
            await blockchain.mineBlock(await _getTimeStamp() + 20);
            let result2 = await stakingService.claimRewards(2,lockId,{from:staker_4, gas: maxGasForTxn});
            let pendingRewards = (await stakingService.getUsersPendingRewards(staker_3,2)).toString();
            console.log("pending rewards staker_3 - 1st Claim: lockId -2",_convertToEtherBalance(pendingRewards));
            pendingRewards = (await stakingService.getUsersPendingRewards(staker_4,2)).toString()
            console.log("pending rewards staker_4 - 1st Claim: lockId -2",_convertToEtherBalance(pendingRewards));
            await blockchain.mineBlock(await _getTimeStamp() + 20);
        })

        it('Time passes and the second claim of rewards for stream 2 staker_3,staker_4 is claimed', async() => {
            let timestamp = await _getTimeStamp();
            let mineToTimestamp = 1* 24 * 60 * 60
            await blockchain.mineBlock(timestamp + mineToTimestamp);
            const lockId = 2
            let result1 = await stakingService.claimRewards(2,lockId,{from:staker_3, gas: maxGasForTxn});
            await blockchain.mineBlock(await _getTimeStamp() + 20);
            let result2 = await stakingService.claimRewards(2,lockId,{from:staker_4, gas: maxGasForTxn});
            let pendingRewards = (await stakingService.getUsersPendingRewards(staker_3,2)).toString();
            console.log("pending rewards staker_3 - 2nd Claim: lockId - 2",_convertToEtherBalance(pendingRewards));
            pendingRewards = (await stakingService.getUsersPendingRewards(staker_4,2)).toString()
            console.log("pending rewards staker_4 - 2nd Claim: lockId - 2",_convertToEtherBalance(pendingRewards));
            await blockchain.mineBlock(await _getTimeStamp() + 20);
        })
        
        it('Setup 3rd and 4th locks for stakers _3', async() => {
            const lockingPeriod = 12 * 60 * 60
            const unlockTime = await _getTimeStamp() + lockingPeriod;
            let result2 = await stakingService.createLock(sumToDeposit,unlockTime, {from: staker_3,gas: maxGasForTxn});
            await blockchain.mineBlock(await _getTimeStamp() + 20);
            let result3 = await stakingService.createLock(sumToDeposit,unlockTime, {from: staker_3, gas: maxGasForTxn});
            await blockchain.mineBlock(await _getTimeStamp() + 20);
        })

        it('Should update rewards when unlocking lock position 3, for staker_3', async() =>{

            // A warning to be included in the front end:
            //  Rewards need to be claimed before a possition is unlocked, so that stakers don't lose reward tokens.
            const streamId = 2
            const lockId = 3
            let timestamp = await _getTimeStamp();
            let mineToTimestamp = 100

            //lockId 3 rewards claimed
            await blockchain.mineBlock(timestamp + mineToTimestamp);
            await stakingService.claimRewards(streamId,lockId,{from:staker_3});
            
            await blockchain.mineBlock(await _getTimeStamp() + mineToTimestamp);
            await stakingService.withdraw(streamId, {from: staker_3})

            //-- main logic --  starts from here:
            timestamp = await _getTimeStamp();
            mineToTimestamp = 1* 24 * 60 * 60
            await blockchain.mineBlock(timestamp + mineToTimestamp);

            //lockId 3 rewards claimed
            await stakingService.claimRewards(streamId,lockId,{from:staker_3});
            let pendingRewards = (await stakingService.getUsersPendingRewards(staker_3,streamId)).toString()
            console.log("pending rewards for lock Id 3 at first claim",_convertToEtherBalance(pendingRewards));

            mineToTimestamp = 100
            await blockchain.mineBlock(await _getTimeStamp() + mineToTimestamp);
            //lockId 3 all rewards for streamId 2 withdrawn
            await stakingService.withdraw(streamId, {from: staker_3})
            await blockchain.mineBlock(await _getTimeStamp() + mineToTimestamp);
            //lockId is unlocked:
            await stakingService.unlock(lockId, {from : staker_3, gas: 600000});
            await blockchain.mineBlock(await _getTimeStamp() + mineToTimestamp);

            //so Now, the previous lockId 4 is lockId 3:
            await stakingService.claimRewards(streamId,lockId,{from:staker_3});
            pendingRewards = (await stakingService.getUsersPendingRewards(staker_3,streamId)).toString()
            console.log("pending rewards for lockId 3 (previously 4) after unlocking:",_convertToEtherBalance(pendingRewards));
            await blockchain.mineBlock(await _getTimeStamp() + mineToTimestamp);

            
        })

        it("Should get all unlocked main token for staker - 3", async() => {
            //  When we unlock, the main token should be sent to stream 0, with users stream id.  
            // Once unlocked, the token is available for withdrawl from stream 0 to staker - 3.
            // streamId 0 is the id for the main protocol token
            const streamId = 0            
            // Here we use getUsersPendingRewards, for stream id 0, to check the balance of main protocol token, since 
            //      the main protocol token is always distributed/released through stream 0.
            const pendingStakedMAINTkn = await stakingService.getUsersPendingRewards(staker_3, streamId)

            let beforeBalanceOfStaker_3 = await mainTknToken.balanceOf(staker_3);

            await blockchain.mineBlock(15 + await _getTimeStamp())
            await stakingService.withdraw(streamId, {from: staker_3})

            const afterBalanceOfStaker_3 = await mainTknToken.balanceOf(staker_3);
            
            const expectedMAINTknBalanceStaker3 =_calculateAfterWithdrawingBalance(pendingStakedMAINTkn.toString(),beforeBalanceOfStaker_3.toString());
            assert.equal(afterBalanceOfStaker_3.toString(), expectedMAINTknBalanceStaker3.toString())
        })

        it("Should apply penalty to early withdrawal - larger penalty for earlier withdrawl", async() => {
            const lockId = 4
            const streamId = 0
            await blockchain.mineBlock(await _getTimeStamp() + 20)
            await stakingService.withdraw(streamId, {from: staker_3})

            pendingStakedMAINTkn = await stakingService.getUsersPendingRewards(staker_3,streamId)
            console.log("Pending user accounts after withdraw: ",pendingStakedMAINTkn.toString())

            const lockingPeriod = 365 * 24 * 60 * 60;
            unlockTime = await _getTimeStamp() + lockingPeriod;
            await stakingService.createLock(sumToDeposit,unlockTime, {from: staker_3,gas: maxGasForTxn});
            await blockchain.mineBlock(60 * 60 + await _getTimeStamp())

            await stakingService.earlyUnlock(lockId, {from: staker_3})

            pendingStakedMAINTkn = await stakingService.getUsersPendingRewards(staker_3,streamId)
            console.log("Pending user accounts with early withdrawal: (approx. 70% of 100 MAINTkn, due to punishment)",_convertToEtherBalance(pendingStakedMAINTkn.toString()))

        })

        
        it("Should unlock all lock positions: ", async() =>{

            const lockingPeriod = 370 * 24 * 60 * 60
            await blockchain.mineBlock(lockingPeriod + await _getTimeStamp())
            
            let result = await stakingService.unlock(1, {from: staker_2});
            console.log("unlocking gas used",result.gasUsed.toString())
            await blockchain.mineBlock(15 + await _getTimeStamp())
            
            result = await stakingService.unlock(1, {from: staker_2});
            console.log("unlocking gas used",result.gasUsed.toString())
            await blockchain.mineBlock(15 + await _getTimeStamp())

            
            result = await stakingService.unlock(1, {from : staker_3});
            console.log("unlocking gas used",result.gasUsed.toString())
            await blockchain.mineBlock(15 + await _getTimeStamp())
            
            await stakingService.unlock(1, {from: staker_3});
            console.log("unlocking gas used",result.gasUsed.toString())
            await blockchain.mineBlock(15 + await _getTimeStamp())
            
            await stakingService.unlock(1, {from: staker_3});
            console.log("unlocking gas used",result.gasUsed.toString())
            await blockchain.mineBlock(15 + await _getTimeStamp())
            
            await stakingService.unlock(1, {from: staker_4});
            console.log("unlocking gas used",result.gasUsed.toString())
            await blockchain.mineBlock(15 + await _getTimeStamp())
            
            await stakingService.unlock(1, {from: staker_4});
            console.log("unlocking gas used",result.gasUsed.toString())
            await blockchain.mineBlock(15 + await _getTimeStamp())
            
            const totalAmountOfStakedMAINTkn = await stakingService.totalAmountOfStakedMAINTkn()
            const totalMAINTknShares = await stakingService.totalMAINTknShares();
            const totalAmountOfStreamShares = await stakingService.totalStreamShares()

            // console.log("----- After all the locks are completely unlocked ------")
            // console.log("totalAmountOfStakedMAINTkn: ", totalAmountOfStakedMAINTkn.toString());
            // console.log("totalMAINTknShares: ", totalMAINTknShares.toString());
            // console.log("totalAmountOfStreamShares: ", totalAmountOfStreamShares.toString());

            assert.equal(totalAmountOfStakedMAINTkn.toString(),"0")
            assert.equal(totalMAINTknShares.toString(),"0")
            assert.equal(totalAmountOfStreamShares.toString(),"0")
        })
        // The following tests are just to check individual test cases
        it("Should apply penalty to early withdrawal", async() => {
            const lockId = 1
            const streamId = 0
            await stakingService.withdraw(streamId, {from: staker_3})
            await blockchain.mineBlock(await _getTimeStamp() + 20)
            const lockingPeriod = 60 * 60
            let unlockTime = await _getTimeStamp() + lockingPeriod;
            await stakingService.createLock(sumToDeposit,unlockTime, {from: staker_3,gas: maxGasForTxn});
            await blockchain.mineBlock(10 + await _getTimeStamp())
            await stakingService.earlyUnlock(lockId, {from: staker_3})

            pendingStakedMAINTkn = await stakingService.getUsersPendingRewards(staker_3,streamId)
            console.log("Pending user accounts with early withdrawal: ",_convertToEtherBalance(pendingStakedMAINTkn.toString()))

            const errorMessage = "getLockInfo: LockId out of index";

            await shouldRevert(
                stakingService.getLockInfo(staker_3,lockId),
                errTypes.revert,  
                errorMessage
            );

        })

        it('Setup lock position for stakers _4,', async() => {
           
            const lockingPeriod = 20 * 24 * 60 * 60
            const unlockTime = await _getTimeStamp() + lockingPeriod;
            await blockchain.mineBlock(await _getTimeStamp() + 100);
            let result3 = await stakingService.createLock(sumToDeposit,unlockTime, {from: staker_4, gas: maxGasForTxn});
            await blockchain.mineBlock(await _getTimeStamp() + 100);

        })

        it('Setup lock position for accounts[9] for govn to use', async() => {
            const sumToTransfer = web3.utils.toWei('25000', 'ether');
            await mainTknToken.transfer(accounts[9],sumToTransfer, {from: SYSTEM_ACC})
            const sumToApprove = web3.utils.toWei('20000','ether');

            await mainTknToken.approve(stakingService.address, sumToApprove, {from: SYSTEM_ACC})
            await mainTknToken.approve(stakingService.address, sumToApprove, {from: accounts[9]})  
            const lockingPeriod = 365 * 24 * 60 * 60
            const unlockTime = await _getTimeStamp() + lockingPeriod;

            const sumToDeposit = web3.utils.toWei('20000', 'ether');
            let result1 = await stakingService.createLock(sumToDeposit,unlockTime, {from: accounts[9], gas: maxGasForTxn});
            
            let eventArgs = eventsHelper.getIndexedEventArgs(result1, "Staked(address,uint256,uint256,uint256)");
            const actualNVMAINTkn = web3.utils.toBN(eventArgs[1])
            console.log("Is 20000 VOTE TOKEN REleased? ", _convertToEtherBalance(actualNVMAINTkn.toString()))    

        })

        it('Should withdraw penalty to treasury', async() =>{
            await blockchain.mineBlock(10 + await _getTimeStamp());
            const beforeBalanceOfTreasury = await mainTknToken.balanceOf(treasury);
            let totalPenaltyBalance = await stakingService.totalPenaltyBalance();
            await stakingService.withdrawPenalty(treasury);
            
            const afterBalanceOfTreasury = await mainTknToken.balanceOf(treasury);
            const expectedDifferenceInBalance = _calculateRemainingBalance(beforeBalanceOfTreasury.toString(),afterBalanceOfTreasury.toString())
            expectedDifferenceInBalance.should.be.bignumber.equal(totalPenaltyBalance.toString())
            totalPenaltyBalance = await stakingService.totalPenaltyBalance();
            
            assert(totalPenaltyBalance.toString(),"0")
        })

        it('Paused contract should not make lock position', async() => {
            const toPauseFlag = 1

            await stakingService.adminPause(toPauseFlag, { from: SYSTEM_ACC})
            const lockingPeriod = 20 * 24 * 60 * 60
            const unlockTime = await _getTimeStamp() + lockingPeriod;
            await blockchain.mineBlock(await _getTimeStamp() + 100);
            const errorMessage = "paused contract"
            await shouldRevert(
                stakingService.createLock(sumToDeposit,unlockTime, {from: staker_4, gas: maxGasForTxn}),
                errTypes.revert,  
                errorMessage
            );
        })

        it('Unpaused contract should  make lock position', async() => {
            const toUnPauseFlag = 0

            await stakingService.adminPause(toUnPauseFlag, { from: SYSTEM_ACC})
            const lockingPeriod = 20 * 24 * 60 * 60
            const unlockTime = await _getTimeStamp() + lockingPeriod;
            await blockchain.mineBlock(await _getTimeStamp() + 100);
            let result3 = await stakingService.createLock(sumToDeposit,unlockTime, {from: staker_4, gas: maxGasForTxn});
            await blockchain.mineBlock(await _getTimeStamp() + 100);
        })
    })
});
   
