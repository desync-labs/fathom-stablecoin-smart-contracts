# Fathom Stablecoin

FXD is a stablecoin designed to maintain a soft peg to the US Dollar. The value of FXD is designed to remain stable, with a slight fluctuation allowed around the target value.

FXD may be borrowed when the user gains the required borrowing power through the collateralization mechanism.
The first source of borrowing power in Fathom Protocol is the deposited XDC (the native coin of the XDC network) as collateral for FXD.

In the future, Fathom Protocol will allow onboarded RWA to be used as possible collaterals for FXD.
The stability of FXD is maintained through various mechanisms, including price oracles, Stable Swap, and a risk management system.

![FXD Key Features](https://i.imgur.com/yPPkWpN.jpg)

## Package version requirements for your machine:

- node v16.4.0
- npm v7.18.1
- CoralX v0.2.0
- Solidity =0.8.16 (solc)
- Ganache CLI v6.12.2 (ganache-core: 2.13.2)

## Setup

The smart contracts are written in [Solidity](https://github.com/ethereum/solidity) and tested/deployed using [CoralX](https://github.com/Securrency-OSS/CoralX).

```bash
# Install nodejs:
$ sudo apt install nodejs

# Install npm:
$ sudo apt install npm

# Intall CoralX from the Securrency private registry
# Install CoralX package globally:
$ npm install -g coral-x

# Install ganache-cli:
$ npm install -g ganache-cli

# Install local node dependencies:
$ npm install

# Install Solc (https://docs.soliditylang.org/en/v0.8.13/installing-solidity.html)
$ curl -o /usr/bin/solc -fL https://github.com/ethereum/solidity/releases/download/v0.8.13/solc-static-linux \
    && chmod u+x /usr/bin/solc

# Create file with "privateKey" private key in the root direcory (use this only for tests):
$ echo -n PRIVATE_KEY > privateKey

# Run ganache with predefined accounts:
$ ganache-cli -m MNEMONIC --gasLimit 12500000 -v -e 100000000

# Create file externalAddresses.json in root
{"1337":{"WXDC":"","USD":"","DEXFactory":""},"1337":{"WXDC":"","USD":"","FTHM":"","DEXFactory":"","PluginOracle":""}}

# now you can run tests:
$ coralX test
### If tests are failing
$ coralx test --skip_compile true --use_snapshot true --publish_failed_tx true

# Deploy to the node

### Fill externalAddresses.json with addresses for EXDC, USD and DEXFactory that must be already deployed to the network (don't forget to make it for appropreate network id).
### You also need to create USD/XDC pair on DEX

### Deploy to Apothem

{"51":{"WXDC":"","USD":"","DEXFactory":""},"1337":{"WXDC":"","USD":"","FTHM":"","DEXFactory":"","PluginOracle":""}}

$ coralX scenario --run deployApothem
