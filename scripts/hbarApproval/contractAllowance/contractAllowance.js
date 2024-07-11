const {ethers} = require("hardhat");
const { transferHbar } = require("../../utils");
const { Client, PrivateKey } = require("@hashgraph/sdk");

async function main() {
    signers = await ethers.getSigners(); 
    [deployer, otherWallet, feeCollector] = signers;
    const client = Client.forTestnet();
    client.setOperator(process.env.OPERATOR_ID, PrivateKey.fromStringECDSA(process.env.OPERATOR_KEY));

    const approvalContractFactory = await ethers.getContractFactory(
        "ApprovalContract"
        );
    const approvalContract = await approvalContractFactory.deploy(
      {gasLimit: 1_000_000}
      );
    const approvalContractAddress = await approvalContract.getAddress();
    console.log("ApprovalContract deployed to:", approvalContractAddress);

    const sendHbarToContract = await transferHbar(client, process.env.OPERATOR_ID, approvalContractAddress, 2);

    const approveTx = await approvalContract.hbarApprovePublic(approvalContractAddress, otherWallet.address, BigInt(2e18), {gasLimit: 1_000_000});
    console.log("Approve tx hash", approveTx.hash);
    //await approveTx.wait();
  
    const allowanceTx = await approvalContract.hbarAllowancePublic(approvalContractAddress, otherWallet.address, {gasLimit: 1_000_000});
    const receipt = await allowanceTx.wait();
    const logs = receipt.logs.find((l) => l.fragment.name === 'HbarAllowance');
    console.log("Allowance", logs.args[2]);

     // cryptoTransferPublic
     const cryptoTransfers = {
      transfers: [
        {
          accountID: approvalContractAddress,
          amount: -1e8,
          isApproval: false,
        },
        {
          accountID: otherWallet.address,
          amount: 1e8,
          isApproval: false,
        },
      ],
    };
    const tokenTransferList = [];

    const deployerWalletBeforeTransfer = await deployer.provider.getBalance(deployer.address);
    console.log("Deployer wallet balance before transfer", deployerWalletBeforeTransfer.toString());
    const otherWalletBeforeTransfer = await deployer.provider.getBalance(otherWallet.address);
    console.log("Other wallet balance before transfer", otherWalletBeforeTransfer.toString());

    const cryptoTransferTx = await approvalContract.connect(otherWallet).cryptoTransferPublic(cryptoTransfers, tokenTransferList, {gasLimit: 1_000_000});

    console.log("Crypto transfer tx hash", cryptoTransferTx.hash);

    const deployerWalletAfterTransfer = await deployer.provider.getBalance(deployer.address);
    console.log("Deployer wallet balance after transfer", deployerWalletAfterTransfer.toString());
    const otherWalletAfterTransfer = await deployer.provider.getBalance(otherWallet.address);
    console.log("Other wallet balance after transfer", otherWalletAfterTransfer.toString());
 
}

main();