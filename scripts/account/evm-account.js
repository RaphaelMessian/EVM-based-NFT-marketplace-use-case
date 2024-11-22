require('dotenv').config({ path: __dirname + '/.env' });

const {
  AccountId,
  PrivateKey,
  Client,
  TransferTransaction,
  TransactionReceiptQuery,
  TokenAirdropTransaction
} = require("@hashgraph/sdk");

async function createEVMAccount() {
  console.log(process.env.OPERATOR_ID);
  const operatorId = AccountId.fromString("0.0.1054");
  const operatorKey = PrivateKey.fromStringECDSA("0x4f1535dcc5cfdc3d197ebcef6e1d7749bd74e9563a5fdeb90e971cdf4b641926");

  const client = Client.forPreviewnet().setOperator(operatorId, operatorKey);

  const privateKey = PrivateKey.generateECDSA();
  console.log(`Private key DER: ${privateKey.toStringDer()}`);

  const publicKey = privateKey.publicKey;
  console.log(`Public key: ${publicKey.toStringDer()}`);

  const evmPrivateKey = privateKey.toStringRaw();
  console.log(`EVM privateKey: ${"0x" + evmPrivateKey}`);
  const evmAddress = publicKey.toEvmAddress();
  console.log(`Corresponding evm address: ${"0x" + evmAddress}`);
  const transferTx = new TransferTransaction()
    .addHbarTransfer(operatorId, -100)
    .addHbarTransfer(evmAddress, 100)
    .freezeWith(client);

  const transferTxSign = await transferTx.sign(operatorKey);
  const transferTxSubmit = await transferTxSign.execute(client);

  const receipt = await new TransactionReceiptQuery()
    .setTransactionId(transferTxSubmit.transactionId)
    .setIncludeChildren(true)
    .execute(client);

  const newAccountId = receipt.children[0].accountId.toString();
  console.log(`Account ID of the newly created account: ${newAccountId}`);

  return evmPrivateKey;

}

createEVMAccount().then(() => {
    console.log("DONE");
    process.exit(0);
});

