const nacl = require('tweetnacl');
nacl.util = require('tweetnacl-util');
const { ethers } = require("hardhat");
const {
    AccountId,
    PrivateKey,
  } = require("@hashgraph/sdk");

async function main() {

  const messageToSign = 'Hedera Account Service';
  const messageHashED = Buffer.from(messageToSign);

  const accountAddress = AccountId.fromString(process.env.OPERATOR_ID_ED);
  const accountAlias = `0x${accountAddress.toSolidityAddress()}`;
  const accountPrivateKey = PrivateKey.fromStringED25519(process.env.OPERATOR_KEY_ED);
  const signature = `0x${Buffer.from(accountPrivateKey.sign(messageHashED)).toString('hex')}`;

  const contractABI = await ethers.getContractFactory(
    "isAuthorizedTest"
    );
  const isAuthorizedContract = await contractABI.deploy(
    {gasLimit: 1_000_000}
    );
  const isAuthorizedAddress = await isAuthorizedContract.getAddress();
  console.log("isAuthorizedTestContract deployed to:", isAuthorizedAddress);

  const isAuthorizedCall = await isAuthorizedContract.isAuthorizedRawPublic(accountAlias, messageHashED, signature, { gasLimit: 2_000_000 });
  const correctSignerReceipt = await (
    await isAuthorizedContract.isAuthorizedRawPublic(
      accountAlias,
      messageHashED,
      signature, 
      {gasLimit: 10_000_000}
    )
  ).wait();

  const correctSignerReceiptResponse = correctSignerReceipt.logs.find(
    (l) => l.fragment.name === 'IsAuthorizedRaw'
  ).args;

  console.log("correctSignerReceiptResponse:", correctSignerReceiptResponse);

}

main();