# Fathom Stablecoin

FXD is a stablecoin intended to maintain a soft peg to the US Dollar. Its value is meant to stay stable, with minor fluctuations permitted around the target price.

Users may borrow FXD once they obtain the necessary borrowing power via the collateralization mechanism. The primary source of borrowing power in the Fathom Protocol comes from depositing XDC (the native coin of the XDC Network) as collateral.

Various mechanisms, including price oracles, Stable Swap, and a risk management system, preserve the stability of FXD.

![FXD Key Features](https://i.imgur.com/yPPkWpN.jpg)

## Package version requirements for your machine:

- node v18.12.1
- npm v8.19.2
- CoralX v0.2.0
- Solidity =0.8.17 (solc)
- Ganache CLI v6.12.2 (ganache-core: 2.13.2)

## Basic setup

The smart contracts are written in [Solidity](https://github.com/ethereum/solidity) and tested/deployed using [CoralX](https://github.com/Securrency-OSS/CoralX).


### Install nodejs:
```bash
$ sudo apt install nodejs
```
### Install npm:
```bash
$ sudo apt install npm
```
### Intall CoralX from the Securrency private registry.
### Install CoralX package globally:
```bash
$ npm install -g coral-x
```
### Install ganache-cli:
```bash
$ npm install -g ganache-cli
```
### Install Solc (https://docs.soliditylang.org/en/v0.8.13/installing-solidity.html)

```bash
$ curl -o /usr/bin/solc -fL https://github.com/ethereum/solidity/releases/download/v0.8.13/solc-static-linux \
    && chmod u+x /usr/bin/solc
```

## Regarding AsterizmInitializerLib

As of July 2024, AsterizmInitializerLib was added to externalAddresses.json. It is a smart contract pre-deployed on EVM chains to enable the bridge functionalities of Fathom Stablecoin. It does not exist in Apothem nor on a freshly run Ganache instance, therefore the deployment script for the FathomBridge contract would revert. Nevertheless, the test scripts run properly, as the FathomBridge smart contract, which uses AsterizmInitializerLib, is not used in the test script; instead, the MockFathomBridge contract is used. If you are deploying to any EVM chains, whether mainnet or testnet, please refer to the documentation below to choose which AsterizmInitializerLib contract address to include in externalAddresses.json.<br>
https://docs.asterizm.io/technical-reference/mainnet<br>
https://docs.asterizm.io/technical-reference/testnet<br>

## Running tests

### 0) After cloning the repo,  install dependencies
```bash
$ npm i
```

### 1) Run ganache with predefined accounts:
```bash
$ ganache-cli -m MNEMONIC --gasLimit 12500000 -v -e 100000000
```

### 2) Create file called "privateKey" in the root directory (to run tests, copy the privateKey of the first account of ganache):

```bash
$ echo -n PRIVATE_KEY_WITHOUT_0x_PREFIX > privateKey
```

Please make sure that the privateKey file's content doesn't have any unneccesary text. The file should only contain privateKey without the 0x prefix. Otherwise, it will fail.

### 3) Create externalAddresses.json file in root

The chainId 1337 addresses are required to execute the test scripts on Ganache. Checksummed addresses must be included in the externalAddresses.json file as placeholder addresses for test execution. Use the content provided below for the externalAddresses.json file to run the test scripts.

```JSON
{
  "1337": {
    "WXDC": "0xf72f1a39ae0736Ef6A532605C85aFB0A4E349714",
    "USD": "0xce75A95160D96F5388437993aB5825F322426E04",
    "FTHM": "0x939Dd5c782620C92843689ad3DD7E7d1F4eb97aB",
    "DEXFactory": "0x5cf9FB75278606F23b2521e77A424174d2CAA2c3",
    "USDSTABLE": "0xb9AdA6B44E4CFF8FE00443Fadf8ad006CfCc2d10",
    "testOracle": "0xc36b26cf999F9f4A085Ce5bD1A541a4B81a70753",
    "AsterizmInitializerLib":"0xA55BDd1701D370cE9E2fb66EC0f934F3Dd981571"
  }
}

```

### 4) Run commands to run tests in root

```bash
$ coralX test
```

The contracts will compile, be deployed, and then the test scripts will run.

To run a specific test script instead of running the the whole tests, run as below. For example, to run PositionPermissions.test.js

```bash
$ coralX test --path integration/PositionPermissions.test.js
```

You might face some tests failing with 'out of gas' error. 

## Deployment

The current codebase is structured so that the same set of smart contracts will be deployed, regardless of the target blockchain. By default, the protocol's price feed after deployment is set to `SimplePriceFeed`, a mock price feed that allows the protocol's deployer (owner) to freely modify prices. This default setting is based on the consideration that other price feeds for commercial use, whether sourcing from a DEX or a Centralized one, require external addresses or even price-related bots for successful deployment. Consequently, the adjusted deployment/migration script will deploy `DexPriceOracle`, `DelayFathomOraclePriceFeed`, `CentralizedOraclePriceFeed`, and `SlidingWindowDexOracle` using proxy patterns, but will not initialize them. Documentation regarding price feed changes will be included in this markdown document following the deployment section.

### On Ganache

#### 0) Run ganache with predefined accounts:
```bash
$ ganache-cli -m MNEMONIC --gasLimit 12500000 -v -e 100000000
```

### 1) Create file called "privateKey" in the root directory (copy the privateKey of the first account of ganache):

```bash
$ echo -n PRIVATE_KEY_WITHOUT_0x_PREFIX > privateKey
```

#### 2) Create externalAddresses.json in root directory. 

The format of the content can be same as in the Running test sections. Like below

```JSON
{
  "1337": {
    "WXDC": "0xf72f1a39ae0736Ef6A532605C85aFB0A4E349714",
    "USD": "0xce75A95160D96F5388437993aB5825F322426E04",
    "FTHM": "0x939Dd5c782620C92843689ad3DD7E7d1F4eb97aB",
    "DEXFactory": "0x5cf9FB75278606F23b2521e77A424174d2CAA2c3",
    "USDSTABLE": "0xb9AdA6B44E4CFF8FE00443Fadf8ad006CfCc2d10",
    "testOracle": "0xc36b26cf999F9f4A085Ce5bD1A541a4B81a70753",
    "AsterizmInitializerLib":"0xA55BDd1701D370cE9E2fb66EC0f934F3Dd981571"
  }
}

```

If you want to see the protocol in action by depositing test ETH and borrowing FXD, I recommend that you first deploy WXDC||WETH on Ganache. After that, update the WXDC address in the externalAddresses.json file with the address of the WXDC you deployed. Additionally, if you aim to thoroughly test the StableSwapModule post-deployment, you must deploy an ERC20 token that can subsequently be deposited into the StableSwapModule. Therefore, please deploy an ERC20 token to substitute for the USD token, and update the USD value in the aforementioned JSON file.

#### 3) Compile contracts

```bash
$ coralX compile
```

make sure that the contracts compile before deployment

#### 4) Deploy with below command

```bash
$ coralX scenario --run deployLocal
```

#### 5) Check contract addresses in addresses.json file in root

After deployment, addresses.json gets updated with addresses of proxies.

### On apothem (XDC Testnet)

#### 1) Create file called "privateKey" in the root directory (PRIVATE_KEY_WITHOUT_0x_PREFIX of the EOA that you would like to deploy contracts from):

```bash
$ echo -n PRIVATE_KEY_WITHOUT_0x_PREFIX > privateKey
```

#### 2) Create externalAddresses.json in root directory.:

ChainID of apothem is 51. Therefore, the externalAddresses.json need to have the sets of addresses having 51 as key. For example, like below.

```JSON
{
    "51": {
      "WXDC": "0xE99500AB4A413164DA49Af83B9824749059b46ce",
      "USD": "0x82b4334F5CD8385f55969BAE0A863a0C6eA9F63f",
      "DEXFactory": "0x6FfcE1bb8fB4841B42C8ee5e91398068723ba80D",
      "USDSTABLE": "0x82b4334F5CD8385f55969BAE0A863a0C6eA9F63f",
      "AsterizmInitializerLib":"0xA55BDd1701D370cE9E2fb66EC0f934F3Dd981571"
    }
}
```

The WXDC address above is officially deployed on the Apothem network. Therefore, I recommend using this address unless you have already deployed or are willing to deploy a new WXDC address for your testing purposes.

For USD addresses, you may use the contract addresses of ERC20 tokens that you deployed yourself, or if you have balances of any USD-pegged stablecoin on Apothem, you can use its address.

The USDSTABLE will be the USD address used for the StableSwapModule. You may keep the same address as the USD address.

DEXFactory refers to the factory address of UniswapV2 fork. In this deployment, you can use the FathomSwap factory address provided above, or you can use your own factory address if you prefer. DEXFactory address was used for the priceOracle and priceFeed that use a DEX as the source of truth, but the default deployment setting does not use the address

#### 4) Compile contracts

```bash
$ coralX compile
```

make sure that the contracts compile before deployment

#### 5) Deploy with below command

```bash
$ coralX scenario --run deployApothem
```

#### 6) Check contract addresses in addresses.json file in root

After deployment, addresses.json gets updated with addresses of proxies.

### On XDC mainnet (chainID 50)

#### 1) Create file called "privateKey" in the root directory (PRIVATE_KEY_WITHOUT_0x_PREFIX of the EOA that you would like to deploy contracts from):

```bash
$ echo -n PRIVATE_KEY_WITHOUT_0x_PREFIX > privateKey
```

#### 2) Create externalAddresses.json in root directory.:

ChainID of XDC mainnet is 50. Therefore, the externalAddresses.json need to have the sets of addresses having 51 as key. For example, like below.

```JSON
{
    "50": {
      "WXDC": "0xE99500AB4A413164DA49Af83B9824749059b46ce",
      "USD": "0x82b4334F5CD8385f55969BAE0A863a0C6eA9F63f",
      "DEXFactory": "0x6FfcE1bb8fB4841B42C8ee5e91398068723ba80D",
      "USDSTABLE": "0x82b4334F5CD8385f55969BAE0A863a0C6eA9F63f",
      "AsterizmInitializerLib":"0xA55BDd1701D370cE9E2fb66EC0f934F3Dd981571"
    }
}
```

WXDC is recommended to have the official WXDC address unless you would like to use other wrapper contracts.

For USD addresses, I recommend USDTx, however, if you have other stable token on XDC that you would like to use, no problem.

The USDSTABLE will be the USD address used for the StableSwapModule. You may keep the same address as the USD address.

DEXFactory refers to the factory address of UniswapV2. In this deployment, you can find and use the FathomSwap factory address or you can use your own factory address if you prefer. DEXFactory address was used for the priceOracle and priceFeed that use a DEX as the source of truth, but the default deployment setting does not use this address.

#### 4) Compile contracts

```bash
$ coralX compile
```

make sure that the contracts compile before deployment

#### 5) Deploy with below command

```bash
$ coralX scenario --run deployMainnet
```

#### 6) Check contract addresses in addresses.json file in root

After deployment, addresses.json gets updated with addresses of proxies.

# PriceFeed

## How to use SimplePriceFeed
The default configuration for deployment specifies that SimplePriceFeed acts as the price feed for XDC collateral. To alter the price of the collateral, you must first establish the price within SimplePriceFeed and then set the Loan-to-Value (LTV) discounted price in the protocol via the PriceOracle contract.

```Solidity=
//In SimplePriceFeed contract

function setPrice(uint256 _price) external onlyOwner {}

```
You can establish the collateral price using the setPrice function mentioned above. To set the price of XDC to 2 USD, call the setPrice function with an argument of 2*10^18.

Once the price is set in SimplePriceFeed, it is necessary to input the LTV discounted price into the protocol. This can be accomplished by calling the function provided below.

```Solidity=
//In PriceOracle contract
    
    function setPrice(bytes32 _collateralPoolId) external override {}

```
The setPrice function of the PriceOracle should be called with an argument, which is the collateralPoolId. This is a padded bytes32 value converted from the string 'XDC'.

0x5844430000000000000000000000000000000000000000000000000000000000

For example, if the price of XDC set by SimplePriceFeed is 1 USD and the Loan-to-Value (LTV) ratio is 70%, then the LTV discounted price would be 0.7 USD.

## How to change priceFeed for the protocol

Please call below function to change priceFeed for the protocol.

```Solidity=
In CollateralPoolConfig

    function setPriceFeed(bytes32 _poolId, address _priceFeed) external onlyOwner {
        require(_priceFeed != address(0), "CollateralPoolConfig/zero-price-feed");
        require(IPriceFeed(_priceFeed).poolId() == _poolId, "CollateralPoolConfig/wrong-price-feed-pool");
        require(IPriceFeed(_priceFeed).isPriceOk(), "CollateralPoolConfig/unhealthy-price-feed");

        IPriceFeed(_priceFeed).peekPrice();

        _collateralPools[_poolId].priceFeed = _priceFeed;
        emit LogSetPriceFeed(msg.sender, _poolId, _priceFeed);
    }
```

Line 5~6 verifies the solvency of the new priceFeed. New priceFeed must have poolId same as the poolId of the collateral that you are trying to change priceFeed of. And also, the new priceFeed should already have its fresh price existing in it.

### Simple way to initialize other priceFeeds and priceOracles

`DexPriceOracle`, `DelayFathomOraclePriceFeed`, `CentralizedOraclePriceFeed`, and `SlidingWindowDexOracle`

can be initialized with script below

```
scripts/migrations/priceFeed/1_initialize.js
````
#### To run the script with DEX as the price source, ensure that:

0) The build files remain unchanged since deployment.
1) The DEXFactory is valid and that an XDC/USD pair exists within the DEXFactory.

The default PriceOracle for DelayFathomOraclePriceFeed is set as DexPriceOracle since SlidingWindowDexOracle requires more involvement of PriceBot that will periodically keep feeding prices to SlidingWindowDexOracle. 

#### Run the init script with below command

```bash
$ coralX execute --path scripts/migrations/priceFeed/1_initialize.js
```

### DEX price feed info

The DelayFathomOraclePriceFeed is designed to replace the SimplePriceFeed with DEX as the price source. To switch to the DelayFathomOraclePriceFeed, you must execute the peekPrice function on DelayFathomOraclePriceFeed twice.

The following demonstrates the relationship between the price contracts. When the setPrice function is called in PriceOracle, the function calls flow as shown below:

PriceOracle -> DelayFathomOraclePriceFeed -> DexPriceOracle -> DEX

When the setPrice function is invoked in PriceOracle, or when a user opens a position, the price updates after a certain delay period has elapsed (default is set to 15 minutes). For more information, please refer to the DelayFathomOraclePriceFeed and DelayPriceFeedBase contract documentation.

In practice, it is possible to test how the collateral price in the DEX is mirrored using DelayFathomOraclePriceFeed without the need for a priceBot. However, if there is insufficient activity from opening positions or if the setPrice function in PriceOracle is not called frequently enough, the price information in DelayFathomOraclePriceFeed may become outdated (with a priceLife of 30 minutes) and hinder CDP actions. In such instances, you should call peekPrice on the DelayFathomOraclePriceFeed, then proceed to call the setPrice function in PriceOracle.