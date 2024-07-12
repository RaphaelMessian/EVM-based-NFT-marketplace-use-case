//The purpose of this script is to demonstrate how to give Hbar approval from an EOA. 
const {ethers} = require("hardhat");

async function main() {
    signers = await ethers.getSigners(); 
    [deployer, otherWallet, treasury] = signers;

    const approvalContractFactory = await ethers.getContractFactory(
        "ContractApproval"
        );
    const approvalContract = await approvalContractFactory.deploy(
      {gasLimit: 1_000_000}
      );
    const approvalContractAddress = await approvalContract.getAddress();
    console.log("ApprovalContract deployed to:", approvalContractAddress);

    const hbarApprovePublic = await ethers.getContractAt("IHRC632", deployer.address);
    const approveContractHbar = await hbarApprovePublic.hbarApprove(approvalContractAddress, BigInt(10e18), {gasLimit: 1_000_000});
    console.log("Hbar approval tx hash", approveContractHbar.hash);

    // cryptoTransferPublic
    const cryptoTransfers = {
        transfers: [
          {
            accountID: deployer.address,
            amount: -10e8,
            isApproval: false,
          },
          {
            accountID: otherWallet.address,
            amount: 10e8,
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