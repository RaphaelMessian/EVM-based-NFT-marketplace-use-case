# EVM-BASED-NFT-MARKETPLACE-USE-CASE

## Setup environment

```shell
cp .env.sample .env
nano .env # edit the OPERATOR_ID and OPERATOR_KEY to match your Hedera Account and Private Key
```

## Installation

```shell
npm i
npx hardhat compile # to compile Smart Contract
```

## Run

```shell
npx hardhat test --network previewnet
```


