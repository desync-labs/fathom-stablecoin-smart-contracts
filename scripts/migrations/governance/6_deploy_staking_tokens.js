// const ERC20TokenReward1 = artifacts.require("./registry-layer/tokens-factory/tokens/ERC-20/ERC20Token.sol");
const ERC20TokenReward1 = artifacts.require("./dao/governance/token/ERC20/ERC20Maintoken.sol");
const ERC20TokenReward2 = artifacts.require("./dao/governance/token/ERC20/ERC20Rewards1.sol");
const ERC20TokenReward3 = artifacts.require("./dao/governance/token/ERC20/ERC20Rewards2.sol");


module.exports = async function(deployer) {
    let promises = [
        deployer.deploy(ERC20TokenReward1, "Reward1 Tokens", "R1T", web3.utils.toWei("1000000","ether"), accounts[0], { gas: 3600000 }),
        deployer.deploy(ERC20TokenReward2, "Reward2 Tokens", "R2T", web3.utils.toWei("1000000","ether"), accounts[0], { gas: 3600000 }),
        deployer.deploy(ERC20TokenReward3, "Reward2 Tokens", "R3T", web3.utils.toWei("1000000","ether"), accounts[0], { gas: 3600000 })
    ];

    await Promise.all(promises);
}