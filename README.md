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
    "WNATIVE": "0xf72f1a39ae0736Ef6A532605C85aFB0A4E349714",
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

The current codebase is structured so that the same set of smart contracts will be deployed, regardless of the target blockchain. By default, the protocol's price feed after deployment is set to `SimplePriceFeed`, a mock price feed that allows the protocol's deployer (owner) to freely modify prices. This default setting is based on the consideration that other price feeds for commercial use require external addresses or even price-related bots for successful deployment. Consequently, the adjusted deployment/migration script will deploy `CentralizedOraclePriceFeed`, 'FathomPriceOracle' using proxy patterns, but only CentralizedOraclePriceFeed will be initialize. Documentation regarding price feed changes will be included in this markdown document following the deployment section.

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
WNATIVE address will be the collateralToken address for the initial collateral NAITVE coin of the network that you deploy fathomStablecoin to.

```JSON
{
  "1337": {
    "WNATIVE": "0xf72f1a39ae0736Ef6A532605C85aFB0A4E349714"
  }
}

```

If you want to see the protocol in action by depositing test ETH and borrowing FXD, I recommend that you first deploy WNATIVE||WETH on Ganache. After that, update the WNATIVE address in the externalAddresses.json file with the address of the WNATIVE you deployed.

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
      "WNATIVE": "0xE99500AB4A413164DA49Af83B9824749059b46ce"
    }
}
```

The WXDC address above is officially deployed on the Apothem network. Therefore, I recommend using this address unless you have already deployed or are willing to deploy a new WXDC address for your testing purposes.

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
      "WNATIVE": "0xE99500AB4A413164DA49Af83B9824749059b46ce"
    }
}
```

WXDC is recommended to have the official WXDC address unless you would like to use other wrapper contracts.

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

0x4e41544956452000000000000000000000000000000000000000000000000000

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

`CentralizedOraclePriceFeed`

can be initialized with script below

```
scripts/migrations/priceFeed/1_setFathomPriceOracle.js
````
#### To run the script for the price feed, ensure that the build files remain unchanged since deployment.

The default is set as CentralizedOraclePriceFeed

### Please prepare setFathomPriceOracle.json file in the root. The file looks like below
```JSON=
{
"51":
{
    "PriceAggregator":"0x0000000000000000000000000000000000000000",
    "SubscriptionsRegistry":"0x0000000000000000000000000000000000000000",
    "CollateralSymbol":"CGO",
},
"1337":
{
    "PriceAggregator":"0x0000000000000000000000000000000000000000",
    "SubscriptionsRegistry":"0x0000000000000000000000000000000000000000",
    "CollateralSymbol":"CGO",
},
"17000":
{
    "PriceAggregator":"0x0000000000000000000000000000000000000000",
    "SubscriptionsRegistry":"0x0000000000000000000000000000000000000000",
    "CollateralSymbol":"CGO",
}
}
```

#### Run the init script with below command

```bash
$ coralX execute --path scripts/migrations/priceFeed/1_setFathomPriceOracle.js --network anyConfiguredNetwork
```