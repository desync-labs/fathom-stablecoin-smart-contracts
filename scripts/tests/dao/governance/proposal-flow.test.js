const blockchain = require("../../helpers/blockchain");
const eventsHelper = require("../../helpers/eventsHelper");
const { assert } = require("chai");
const BigNumber = require("bignumber.js");
const {
    shouldRevert,
    errTypes
} = require('../../helpers/expectThrow');

const EMPTY_BYTES = '0x0000000000000000000000000000000000000000000000000000000000000000';

// Proposal 1
const PROPOSAL_DESCRIPTION = "Proposal #1: Store 1 in the Box contract";
const NEW_STORE_VALUE = "5";

// / proposal 2
const PROPOSAL_DESCRIPTION_2 = "Proposal #2: Distribute funds from treasury to accounts[5]";
const AMOUNT_OUT_TREASURY = "1000";

// Events
const PROPOSAL_CREATED_EVENT = "ProposalCreated(uint256,address,address[],uint256[],string[],bytes[],uint256,uint256,string)"
const SUBMIT_TRANSACTION_EVENT = "SubmitTransaction(uint256,address,address,uint256,bytes)";

// Token variables
const T_TOKEN_TO_MINT = "10000000000000000000000";



// ================================================================================================
// FROM SUBIK JIs STAKING TEST CODE:
// const ERC20TokenMAINTkn = artifacts.require("./registry-layer/tokens-factory/tokens/ERC-20/ERC20Token.sol");
// const IERC20 = artifacts.require("./common/interfaces/erc20/IERC20.sol");

const T_TO_STAKE = web3.utils.toWei('2000', 'ether');
const STAKED_MIN = web3.utils.toWei('1900', 'ether');

const SYSTEM_ACC = accounts[0];
const STAKER_1 = accounts[5];
const STAKER_2 = accounts[6];
const NOT_STAKER = accounts[7];
const stream_owner = accounts[3];

const _getTimeStamp = async () => {
    const timestamp = await blockchain.getLatestBlockTimestamp()
    return timestamp
}
//this is used for stream shares calculation.
const veMainTokenCoefficient = 500;
// ================================================================================================

describe('Proposal flow', () => {

    let timelockController
    let veMainToken
    let mainTokenGovernor
    let box
    let mainToken
    let multiSigWallet
    
    let proposer_role
    let executor_role
    let timelock_admin_role

    let proposalId
    let proposalId2
    let result
    let encoded_function
    let encoded_transfer_function
    let encoded_treasury_function
    let description_hash
    let description_hash_2

    let txIndex

    const oneMonth = 30 * 24 * 60 * 60;
    const oneYear = 31556926;
    let lockingPeriod
    let minter_role
    let maxNumberOfLocks
    let lockingVoteWeight

 

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
    
    before(async () => {
        await snapshot.revertToSnapshot();

        timelockController = await artifacts.initializeInterfaceAt("TimelockController", "TimelockController");
        veMainToken = await artifacts.initializeInterfaceAt("VeMainToken", "VeMainToken");
        mainTokenGovernor = await artifacts.initializeInterfaceAt("MainTokenGovernor", "MainTokenGovernor");
        box = await artifacts.initializeInterfaceAt("Box", "Box");
        mainToken = await artifacts.initializeInterfaceAt("MainToken", "MainToken");

        multiSigWallet = await artifacts.initializeInterfaceAt("MultiSigWallet", "MultiSigWallet");
        
        proposer_role = await timelockController.PROPOSER_ROLE();
        executor_role = await timelockController.EXECUTOR_ROLE();
        timelock_admin_role = await timelockController.TIMELOCK_ADMIN_ROLE();

        // For staking:
        maxWeightShares = 1024;
        minWeightShares = 256;
        maxWeightPenalty = 3000;
        minWeightPenalty = 100;
        weightMultiplier = 10;
        maxNumberOfLocks = 10;

        const weightObject =  _createWeightObject(
            maxWeightShares,minWeightShares,maxWeightPenalty,minWeightPenalty, weightMultiplier
            );

        stakingService = await artifacts.initializeInterfaceAt(
            "IStaking",
            "StakingPackage"
        );

        vaultService = await artifacts.initializeInterfaceAt(
            "IVault",
            "VaultPackage"
        );
        
        mainTknToken = await artifacts.initializeInterfaceAt("ERC20MainToken","ERC20MainToken");

        lockingPeriod =  365 * 24 * 60 * 60;
        await veMainToken.addToWhitelist(stakingService.address, {from: SYSTEM_ACC});
        minter_role = await veMainToken.MINTER_ROLE();
        await veMainToken.grantRole(minter_role, stakingService.address, {from: SYSTEM_ACC});

        veMainTokenAddress = veMainToken.address;
        mainTknTokenAddress = mainTknToken.address;

        await vaultService.addSupportedToken(mainTknTokenAddress);

        lockingVoteWeight = 365 * 24 * 60 * 60;
        maxNumberOfLocks = 10;

        const scheduleRewards = [
            web3.utils.toWei('2000', 'ether'),
            web3.utils.toWei('1000', 'ether'),
            web3.utils.toWei('500', 'ether'),
            web3.utils.toWei('250', 'ether'),
            web3.utils.toWei("0", 'ether')
        ]

        const startTime =  await _getTimeStamp() + 3 * 24 * 24 * 60;
        vault_test_address = vaultService.address;

        const scheduleTimes = [
            startTime,
            startTime + oneYear,
            startTime + 2 * oneYear,
            startTime + 3 * oneYear,
            startTime + 4 * oneYear,
        ]
        
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
         )

        // encode the function call to change the value in box.  To be performed if the vote passes
        encoded_function = web3.eth.abi.encodeFunctionCall({
            name: 'store',
            type: 'function',
            inputs: [{
                type: 'uint256',
                name: 'value'
            }]
        }, [NEW_STORE_VALUE]);

        // encoded transfer function call for the main token.
        encoded_transfer_function = web3.eth.abi.encodeFunctionCall({
            name: 'transfer',
            type: 'function',
            inputs: [{
                type: 'address',
                name: 'to'
            },{
                type: 'uint256',
                name: 'amount'
            }]
        }, [STAKER_1, AMOUNT_OUT_TREASURY]);

        // encode the function call to release funds from MultiSig treasury.  To be performed if the vote passes
        encoded_treasury_function = web3.eth.abi.encodeFunctionCall({
            name: 'submitTransaction',
            type: 'function',
            inputs: [{
                type: 'address',
                name: '_to'
            },{
                type: 'uint256',
                name: '_value'
            },{
                type: 'bytes',
                name: '_data'
            }]
        }, [mainToken.address, EMPTY_BYTES, encoded_transfer_function]);

        description_hash = web3.utils.keccak256(PROPOSAL_DESCRIPTION);
        description_hash_2 = web3.utils.keccak256(PROPOSAL_DESCRIPTION_2);

    });

    describe("Assign MainToken Governor and TimeLock roles", async() => {
        // TODO: test _roles, Check that they can make transactions, revoke _roles, try again expecting bounces
        it('Grant propser, executor and timelock admin roles to MainTokenGovernor', async() => {

            await timelockController.grantRole(proposer_role, mainTokenGovernor.address, {"from": accounts[0]});
            await timelockController.grantRole(timelock_admin_role, mainTokenGovernor.address, {"from": accounts[0]});
            await timelockController.grantRole(executor_role, mainTokenGovernor.address, {"from": accounts[0]});
        });

    });



    // TODO: Needs to revert when there is no value
    describe("Box contract", async() => {

        it('Retrieve returns a value previously stored', async() => {
            // Store a value
            await box.store(42);

            // Test if the returned value is the same one
            expect((await box.retrieve()).toString()).to.equal('42');
        });

        it('Transfer ownership of the box', async() => {
            await box.transferOwnership(timelockController.address);
            
            const new_owner = await box.owner();
            assert.equal(new_owner, timelockController.address);
        });

    });


    describe("Staking MainToken to receive veMainToken token", async() => {

        const _stakeMainGetVe = async (_account) => {

            await mainTknToken.transfer(_account, T_TO_STAKE, {from: SYSTEM_ACC});

            await mainTknToken.approve(stakingService.address, T_TO_STAKE, {from: _account});

            await blockchain.increaseTime(20);

            let unlockTime = await _getTimeStamp() + lockingPeriod;

            await stakingService.createLock(T_TO_STAKE, unlockTime, {from: _account, gas: 600000});
        }

        it('Stake MainToken and receive veMainToken', async() => {
            // Here Staker 1 and staker 2 receive veMainTokens for staking MainTokens
            await _stakeMainGetVe(STAKER_1);
            await _stakeMainGetVe(STAKER_2);

            // Wait 1 block
            const currentNumber = await web3.eth.getBlockNumber();
            const block = await web3.eth.getBlock(currentNumber);
            const timestamp = block.timestamp;
            await blockchain.mineBlock(timestamp + 1);

        });


        it('Should revert transfer if holder is not whitelisted to transfer', async() => {

            let errorMessage = "VeMainToken: is intransferable unless the sender is whitelisted";

            await shouldRevert(
                veMainToken.transfer(
                    accounts[2],
                    "10",
                    {from: accounts[1]}
                ),
                errTypes.revert,
                errorMessage
            ); 
        });
    });

    describe("Update Parameter Through Governer", async() => {

        it('Should revert proposal if: proposer votes below proposal threshold', async() => {

            let errorMessage = "Governor: proposer votes below proposal threshold";

            await shouldRevert(
                mainTokenGovernor.propose(
                    [box.address],
                    [0],
                    [encoded_function],
                    PROPOSAL_DESCRIPTION,
                    {"from": accounts[9]}
                ),
                errTypes.revert,
                errorMessage
            );
        });


        it('Propose a change to the boxs store value', async() => {

            // create a proposal in MainToken governor
            result = await mainTokenGovernor.propose(
                [box.address],
                [0],
                [encoded_function],
                PROPOSAL_DESCRIPTION,
                {"from": STAKER_1}
            );
            // retrieve the proposal id
            proposalId = eventsHelper.getIndexedEventArgs(result, PROPOSAL_CREATED_EVENT)[0];    
        });

        it('Check that the proposal status is: Pending', async() => {
            expect((await mainTokenGovernor.state(proposalId)).toString()).to.equal("0");
        })

        it('Wait two blocks and then check that the proposal status is: Active', async() => {

            const currentNumber = await web3.eth.getBlockNumber();
            const block = await web3.eth.getBlock(currentNumber);
            const timestamp = block.timestamp;
            
            var nextBlock = 1;    
            while (nextBlock <= 2) {   
                await blockchain.mineBlock(timestamp + nextBlock);    
                nextBlock++;              
            }
            // Check that the proposal is open for voting
            expect((await mainTokenGovernor.state(proposalId)).toString()).to.equal("1");
        });

        it('Vote on the proposal', async() => {

            // enum VoteType {
            //     Against,
            //     For,
            //     Abstain
            // }
            // =>  0 = Against, 1 = For, 2 = Abstain 

            const currentNumber = await web3.eth.getBlockNumber();
            const block = await web3.eth.getBlock(currentNumber);
            const timestamp = block.timestamp;
            
            var nextBlock = 1;
            while (nextBlock <= 2) {   
                await blockchain.mineBlock(timestamp + nextBlock);    
                nextBlock++;              
            }
            // Vote:
            await mainTokenGovernor.castVote(proposalId, "1", {"from": STAKER_1});
        });


        it('Wait 40 blocks and then check that the proposal status is: Succeeded', async() => {
            const currentNumber = await web3.eth.getBlockNumber();
            const block = await web3.eth.getBlock(currentNumber);
            const timestamp = block.timestamp;
            
            var nextBlock = 1;
            while (nextBlock <= 40) {   
                await blockchain.mineBlock(timestamp + nextBlock);
                nextBlock++;              
            }

            expect((await mainTokenGovernor.state(proposalId)).toString()).to.equal("4");
        });

        it('Queue the proposal', async() => {

            // Functions mainTokenGovernor.propose and mainTokenGovernor.queue have the same input, except for the
            //      description parameter, which we need to hash.
            //
            // A proposal can only be executed if the proposalId is the same as the one stored 
            //      in the governer contract that has passed a vote.
            // In the Governor.sol contract, the proposalId is created using all information used 
            //      in to create the proposal:
            // uint256 proposalId = hashProposal(targets, values, calldatas, keccak256(bytes(description)));

            const result = await mainTokenGovernor.queue(      
                [box.address],
                [0],
                [encoded_function],
                description_hash,
                {"from": accounts[0]}
            );            
        });

        it('Approve the proposal from accounts 0 AND 1', async() => {
            await mainTokenGovernor.confirmProposal(proposalId, {"from": accounts[0]});
            await mainTokenGovernor.confirmProposal(proposalId, {"from": accounts[1]});
        });

        it('Wait 40 blocks and then check that the proposal status is: Queued', async() => {

            const currentNumber = await web3.eth.getBlockNumber();
            const block = await web3.eth.getBlock(currentNumber);
            const timestamp = block.timestamp;
            
            var nextBlock = 1;
            while (nextBlock <= 40) {   
                await blockchain.mineBlock(timestamp + nextBlock); 
                nextBlock++;              
            }
            expect((await mainTokenGovernor.state(proposalId)).toString()).to.equal("5");
        });

        it('Execute the proposal', async() => {

            const result = await mainTokenGovernor.execute(      
                [box.address],
                [0],
                [encoded_function],
                description_hash,
                {"from": accounts[0]}
            );
        });

        it('Check that the proposal status is: succesful', async() => {
            expect((await mainTokenGovernor.state(proposalId)).toString()).to.equal("7");
        })

        it('Should retrieve the updated value proposed by governance for the new store value in box.sol', async() => {

            const new_val = await box.retrieve();

            // Test if the returned value is the new value
            expect((await box.retrieve()).toString()).to.equal(NEW_STORE_VALUE);
        });
    });

    describe( "MultiSig Treasury", async() => {

        it('Mint MainToken token to MultiSig treasury', async() => {
            await mainToken.mint(multiSigWallet.address, T_TOKEN_TO_MINT, { from: accounts[0]});
            expect((await mainToken.balanceOf(multiSigWallet.address, {"from": accounts[0]})).toString()).to.equal(T_TOKEN_TO_MINT);
        });

        // Need ot make exhaustive MultiSig tests 
        // it('', async() => {  
        // });
    });

    describe("VC Treasury Distribution Through Governor", async() => {

        it('Create proposal to send VC funds from MultiSig treasury to account 5', async() => {

            // create a proposal in MainToken governor
            result = await mainTokenGovernor.propose(
                [multiSigWallet.address],
                [0],
                [encoded_treasury_function],
                PROPOSAL_DESCRIPTION_2,
                {"from": STAKER_1}
            );

            // retrieve the proposal id
            proposalId2 = eventsHelper.getIndexedEventArgs(result, PROPOSAL_CREATED_EVENT)[0];
   
        });

        it("Should retrieve voting weights", async () => {

            const currentNumber = await web3.eth.getBlockNumber();

            expect(parseInt((await mainTokenGovernor.getVotes(STAKER_1, currentNumber - 1 )).toString())).to.be.above(parseInt(STAKED_MIN));
            expect(parseInt((await mainTokenGovernor.getVotes(STAKER_2, currentNumber - 1 )).toString())).to.be.above(parseInt(STAKED_MIN));
            assert.equal( await mainTokenGovernor.getVotes(NOT_STAKER, currentNumber - 1 ), "0");
        });


        it('Vote on the second proposal', async() => {

            // enum VoteType {
            //     Against,
            //     For,
            //     Abstain
            // }
            // =>  0 = Against, 1 = For, 2 = Abstain 

            const currentNumber = await web3.eth.getBlockNumber();
            const block = await web3.eth.getBlock(currentNumber);
            const timestamp = block.timestamp;
            
            var nextBlock = 1;
            while (nextBlock <= 2) {   
                await blockchain.mineBlock(timestamp + nextBlock);    
                nextBlock++;              
            }
            // Vote:
            await mainTokenGovernor.castVote(proposalId2, "1", {"from": STAKER_1});

        });

        it("Should not allow an account to vote twice on the same proposal", async () => {
            const errorMessage = "GovernorVotingSimple: vote already cast";
              
            await shouldRevert(
                mainTokenGovernor.castVote(proposalId2, "1", {"from": STAKER_1}),
                errTypes.revert,
                errorMessage
            ); 
            
        });

        it("Should not vote outside of option range", async () => {
            const errorMessage = "GovernorVotingSimple: invalid value for enum VoteType";
              
            await shouldRevert(
                mainTokenGovernor.castVote(proposalId2, "3", {"from": STAKER_2}),
                errTypes.revert,
                errorMessage
            ); 
        });


        it('Wait 40 blocks and then check that the proposal status is: Succeeded', async() => {
            const currentNumber = await web3.eth.getBlockNumber();
            const block = await web3.eth.getBlock(currentNumber);
            const timestamp = block.timestamp;
            
            var nextBlock = 1;
            while (nextBlock <= 40) {   
                await blockchain.mineBlock(timestamp + nextBlock);
                nextBlock++;              
            }
            // Check that the proposal is succesful:
            expect((await mainTokenGovernor.state(proposalId2)).toString()).to.equal("4"); 
        });


        it("Should not accept votes outside of the voting period", async () => {
            const errorMessage = "Governor: vote not currently active";
              
            await shouldRevert(
                mainTokenGovernor.castVote(proposalId2, "1", {"from": STAKER_1}),
                errTypes.revert,
                errorMessage
            );            
        });

        it('Queue the second proposal', async() => {
            await mainTokenGovernor.queue(      
                [multiSigWallet.address],
                [0],
                [encoded_treasury_function],
                description_hash_2,
                {"from": accounts[0]}
            );
        });

        it('Approve the proposal from accounts 0 AND 1', async() => {
            await mainTokenGovernor.confirmProposal(proposalId2, {"from": accounts[0]});
            await mainTokenGovernor.confirmProposal(proposalId2, {"from": accounts[1]});
        });

        it('Wait 40 blocks and then check that the proposal status is: Queued', async() => {
            const currentNumber = await web3.eth.getBlockNumber();
            const block = await web3.eth.getBlock(currentNumber);
            const timestamp = block.timestamp;
    
            var nextBlock = 1;
            while (nextBlock <= 40) {   
                await blockchain.mineBlock(timestamp + nextBlock); 
                nextBlock++;              
            }
            expect((await mainTokenGovernor.state(proposalId2)).toString()).to.equal("5");
        });

        it('Execute the second proposal', async() => {
            result = await mainTokenGovernor.execute(      
                [multiSigWallet.address],
                [0],
                [encoded_treasury_function],
                description_hash_2,
                {"from": accounts[0]}
            );
            txIndex = eventsHelper.getIndexedEventArgs(result, SUBMIT_TRANSACTION_EVENT)[0];

            // Check that the proposal status is: Executed
            expect((await mainTokenGovernor.state(proposalId2)).toString()).to.equal("7");

        });

        it('Confirm and Execute the release of funds from MultiSig treasury', async() => {
            // Here the acocunts which have been designated a "Signer" role for the governor 
            //      need to confirm each transaction before it can be executed.
            await multiSigWallet.confirmTransaction(txIndex, {"from": accounts[0]});
            await multiSigWallet.confirmTransaction(txIndex, {"from": accounts[1]});
            // Execute:
            await multiSigWallet.executeTransaction(txIndex, {"from": accounts[0]});
            // Balance of account 5 should reflect the funds distributed from treasury in proposal 2
            expect((await mainToken.balanceOf(STAKER_1, {"from": STAKER_1})).toString()).to.equal(AMOUNT_OUT_TREASURY);
        });

        
    });
});

