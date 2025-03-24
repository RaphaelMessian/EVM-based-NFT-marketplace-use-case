const { ethers } = require("hardhat");
const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../.env') })

async function main() {
    
  const [deployer] = await ethers.getSigners();
  const messageToSign = 'Hedera Account Service';
  const messageHashEC = ethers.hashMessage(messageToSign);

  const contractABI = await ethers.getContractFactory(
    "isAuthorizedTest"
    );
  const isAuthorizedContract = await contractABI.deploy(
    {gasLimit: 1_000_000}
    );
  const isAuthorizedAddress = await isAuthorizedContract.getAddress();
  console.log("isAuthorizedTestContract deployed to:", isAuthorizedAddress);

  const signature = await deployer.signMessage(messageToSign);

  const correctSignerReceipt = await (
    await isAuthorizedContract.isAuthorizedRawPublic(
      deployer.address, // correct signer
      messageHashEC,
      signature,
      {gasLimit: 2_000_000}
    )
  ).wait();

  const correctSignerReceiptResponse = correctSignerReceipt.logs.find(
    (l) => l.fragment.name === 'IsAuthorizedRaw'
  ).args;
  console.log("correctSignerReceiptResponse :", correctSignerReceiptResponse);
}

main();