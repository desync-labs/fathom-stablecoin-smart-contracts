# StableSwap Module
## _Keep the Stablecoin Stable_

Stableswap module is the stablity module to keep stablecoin pegged to it's original value. Arbitrauger uses it to earn profile in case Stablecoin value depagged, that results value reset back to it's original peg

## How It Works
There are mainly 3 actors involved in the demo scripts, *Deployer*, *Alice* and *Arbitrauger*.
- *Deployer*
        - Deploy the smart contract 
        - Mint the required collatral to all invovled actors including himself
        - Open position on behalf of StableSwap Module by providing collatral
        - Provide liquidity to DEX using USDT-Fathom Stablecoin and WXDC-USDT pairing.
- *Alice*
        - Open the position in protocol by providing collatral and recieve stablecoins.
        - Simulate the stablecoin de-pagging by supplying the stablecoin to USDT-Fathom Stablecoin pair in DEX.
- *Arbitrauger*
        - As price of stablecoin reduced, arbitrauger buy cheap stablecoin from DEX.
        - Arbitrager sell the stablecoin in StableSwap module which guanrteed return with 1:1.
        - Arbitrager earn profit.
        
## Designs
How it works [TBD]

## Setup

Open the terminal and run the local instance of ganache using below command.

```sh
ganache-cli -m YOUR MNEMONIC --gasLimit 12000000
```

Navigate to DEX (Uniswap v2 fork) and deploy it on local instance of ganache using below scripts.

```sh
cd uniswap-fork
npx hardhat run --network ganache scripts/0_deployment.js    
```
Copy the UniswapFactory and Router addresses from output of uniswap-fork deployment a. The out should be like below
> UniswapFactory was deployed to: 0xce75A95160D96F5388437993aB5825F322426E04
> WETH token was deployed on address 0x0e52147E1aD0d48F76074214e0782EE4A6Dca120
> Router was deployed to: 0x0D2B0406bc8400E61f7507bDed415c98E54A8b11    

Paste the addresses in env file at root of `FATHOMSTABLECOIN` along with top 4 private keys from ganache-cli provided accounts.

> PRIVATE_KEY1=0x77818cb7cde7c16a79759cc9198a307cdbe7f2de19cb8c9ad976225581806846
> PRIVATE_KEY2=0x37da9b70f33a72a65ae3b78d0e207934cd7c82a82f666e31b5e5b4fe286c7105
> PRIVATE_KEY3=0x75beebe6f939348b51a4b8d2d7666c420207d9762df9bcd4921a8908629a8bcb
> PRIVATE_KEY4=0x66d41b24420fc8dea6b1cc69ab5871879f544901cc2be98350f87a86eb5a2279
> UNISWAP_FACTORY=0xce75A95160D96F5388437993aB5825F322426E04
> UNISWAP_ROUTER=0xce75A95160D96F5388437993aB5825F322426E04

Now we are ready to run our stableswap scrips.



## Run StableSwap Scripts
Navigate to Fathom stablecoin repository and install the dependencies and devDependencies using `npm install`.

```sh
cd FATHOMSTABLECOIN
npm i
```

- ##### Smart Contract Deployment

        ```sh
        cd FATHOMSTABLECOIN
        npx hardhat run --network ganache scripts/e_stableSwapScenario/0_deployment.js
        ```
        This command will deploy all required smart contracts to local running instance of ganache. Also this command will mint the required tokens to all actors i.e. *Deployer*, *Alice* & *Arbitrauger*. At this point the balance of all actors are as below:
        | Actor             | WXDC     | USDT     | Fathom StableCoin |
        | ---------     | ------ | ------ | ----------------- |
        |*Deployer*     | 10,000 | 10,000 |             0                     |
        | *Alice*         | 0            | 10,000 |             0                     |
        |*Arbitrauger*| 0            |    1000    |             0                     |
- ##### Initialize the Collatral Pool 
        ```sh
        npx hardhat run --network ganache scripts/e_stableSwapScenario/1_collateralPoolConfig.js 
        ```
        
 - ##### Check Balance | *Deployer*
     ```sh
        npx hardhat run --network ganache scripts/e_stableSwapScenario/2_checkPriceDeployer.js    
        ```
        | Actor             | WXDC     | USDT     | Fathom StableCoin |
        | ---------     | ------ | ------ | ----------------- |
        |*Deployer*     | 10,000 | 10,000 |             0                     |
        | *Alice*         | 0            | 10,000 |             0                     |
        |*Arbitrauger*| 0            |    1000    |             0                     |

 - ##### Perform SwapTokenToStableCoin |    *Deployer*
     In this step *Deployer* will provide the 5000 USDT collatral to StableSwap Module to mint stablecoin.     
     ```sh
        npx hardhat run --network ganache scripts/e_stableSwapScenario/3_swapTokenToStablecoin.js     
        ```         
        | Actor             | WXDC     | USDT     | Fathom StableCoin |
        | ---------     | ------ | ------ | ----------------- |
        |*Deployer*     | 10,000 | 5000     |             4995 ( 5 will go to debtengine as fee)                | 
        | *Alice*         |     0        | 10,000 |             0                     |
        |*Arbitrauger*|     0        |    1000    |             0                     |

 - ##### Provide Liquidity To Dex |    *Deployer*
     Now *Deployer* provide the liquidity to dex as 
        - WXDC-USDT                : 1000-2000
        - FathomUSD - USDT : 3000-3000
     ```sh
        npx hardhat run --network ganache scripts/e_stableSwapScenario/4_provideLiquidityToDEX.js     
        ```    
        This will result the price of FathomUSD set to 1. We can check the updated balance of deployer as below
        ```sh
        npx hardhat run --network ganache scripts/e_stableSwapScenario/5_checkPriceDeployer.js        
        ``` 
        | Actor             | WXDC     | USDT     | Fathom StableCoin |
        | ---------     | ------ | ------ | ----------------- |
        |*Deployer*     | 9 ,000 |        0     |             1995                | 
        | *Alice*         | 0            | 10,000 |             0                     |
        |*Arbitrauger*|                |    1000    |             0                     |
 - ##### Open position | *Alice*
        Now *Alice* can open a position with providing 300 USDT as collatral to receive back the stablecoin of 150 keepign his position safe by overcollatralisation.
     ```sh
        npx hardhat run --network ganache scripts/e_stableSwapScenario/6_makeWalletForAlice.js
        npx hardhat run --network ganache scripts/e_stableSwapScenario/7_openPositionsForAlice.js 
        ```    
        
        We can check the balance of *Alice* as:
     ```sh
        npx hardhat run --network ganache scripts/e_stableSwapScenario/8_checkPriceAlice.js 
        ```    
        | Actor             | WXDC     | USDT     | Fathom StableCoin |
        | ---------     | ------ | ------ | ----------------- |
        |*Deployer*     | 9 ,000 |        0     |             1995                | 
        | *Alice*         | 0            | 9700     |             150                 |
        |*Arbitrauger*|                |    1000    |                0                    |
        
 - ##### De-Peg Stablecoin |    *Alice*
        Alice try to de-peg the stablecoin by providing 100 stablecoin to DEX 
     ```sh
        npx hardhat run --network ganache scripts/e_stableSwapScenario/9_depagStableCoinPrice.js    
        ```    
        `As a result the price of stablecoin dropped to ~0.9366. We can check the stablecoin price and updated balance of Alice as`: 
     ```sh
        npx hardhat run --network ganache scripts/e_stableSwapScenario/10_checkPriceAlice.js    
        ```
        | Actor             | WXDC     | USDT     | Fathom StableCoin |
        | ---------     | ------ | ------ | ----------------- |
        |*Deployer*     | 9 ,000 |        0     |             1995                | 
        | *Alice*         | 0            | ~9796    |                50                 |
        |*Arbitrauger*| 0             |    1000    |             0                    |

- ##### Arbitrauge |    *Arbitrauger*

        Find it as an opportunity to buy cheap stablecoin, *Arbitrauger* buy Stablecoin (at rate `~0.9366`) from DEX at the reduced rate by providing 100 USDT from his balance `.
        
     ```sh
        npx hardhat run --network ganache scripts/e_stableSwapScenario/11_arbitraguer_dex_stableswap.js    
        ```
        
        `As a result of this, the price of stablecoin reset back to it's original value i.e. ~ $1`
        
        As Now the updated balance can be checked as 
        ```sh
        npx hardhat run --network ganache scripts/e_stableSwapScenario/12_checkPriceArbitrageur.js
        ```
        | Actor             | WXDC     | USDT     | Fathom StableCoin |
        | ---------     | ------ | ------ | ----------------- |
        |*Deployer*     | 9 ,000 |        0     |             1995                | 
        | *Alice*         | 0            | ~9796    |                50                 |
        |*Arbitrauger*| 0            |    900    |                102                 |
        
- ##### swapStablecoinToToken |    *Arbitrauger*

         *Arbitrauger* sells those stablecoins to StableSwap module and earn the profit
        ```sh
        npx hardhat run --network ganache scripts/e_stableSwapScenario/13_swapStablecoinToToken.js
        ```
        
        Now the updated balance is 
        
        | Actor             | WXDC     | USDT     | Fathom StableCoin |
        | ---------     | ------ | ------ | ----------------- |
        |*Deployer*     | 9 ,000 |        0     |             1995                | 
        | *Alice*         | 0            | ~9796    |                50                 |
        |*Arbitrauger*| 0            |    1002    |                ~0.81            |