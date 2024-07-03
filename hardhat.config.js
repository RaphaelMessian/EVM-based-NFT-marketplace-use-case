require("@nomicfoundation/hardhat-toolbox");
require('dotenv').config({ path: __dirname + '/.env' });

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.24",
  settings: {
    optimizer: {
      enabled: true,
      runs: 500,
    },
  },
  gasReporter: {
    enabled: true,
  },
  defaultNetwork: "testnet",
  networks: {
    testnet: {
      // HashIO testnet endpoint from the TESTNET_ENDPOINT variable in the .env file
      url: process.env.TESTNET_ENDPOINT,
      timeout: 2000000000,
      allowUnlimitedContractSize: true,
      // Your ECDSA account private key pulled from the .env file
      accounts: [process.env.OPERATOR_KEY, process.env.OTHER_OPERATOR_KEY, process.env.FEE_COLLECTOR_KEY],
    },
    // previewnet: {
    //   // HashIO testnet endpoint from the TESTNET_ENDPOINT variable in the .env file //https://previewnet.hashio.io/api
    //   url: 'https://previewnet.hashio.io/api', //https://previewnet.hashio.io/api http://localhost:7546/
    //   timeout: 20000000000,
    //   allowUnlimitedContractSize: true,
    //   // Your ECDSA account private key pulled from the .env file
    //   accounts: [process.env.OPERATOR_KEY, process.env.OTHER_OPERATOR_KEY, process.env.TREASURY_KEY],
    // },
  }
};
