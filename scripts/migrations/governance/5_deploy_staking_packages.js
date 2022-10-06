const PackageStaking = artifacts.require('./dao/staking/packages/StakingPackage.sol');
const VaultPackage = artifacts.require('./dao/staking/vault/packages/VaultPackage.sol');

module.exports = async function(deployer) {
    let promises = [
        deployer.deploy(PackageStaking, {gas: 8000000}),
        deployer.deploy(VaultPackage, {gas: 8000000})
    ];

    await Promise.all(promises);
}