//The purpose of this script is to transfer some CCIP-BnM tokens from Hedera to Sepolia using CCIP.
const {ethers} = require("hardhat");

async function main() {
    signers = await ethers.getSigners(); 
    [deployer] = signers;

    //router address on Hedera
    const routerAddress = "0x802C5F84eAD128Ff36fD6a3f8a418e339f467Ce4";
    //Link address on Hedera
    const linkAddress = "0x90a386d59b9A6a4795a011e8f032Fc21ED6FEFb6";

    const IERC20 = [
    "function transfer(address to, uint256 amount) external returns (bool)",
    "function balanceOf(address account) external view returns (uint256)"
    ];

    //First deploy the TokenTransferor contract
    const tokenTransferorFactory = await ethers.getContractFactory(
        "TokenTransferor"
        );
    const tokenTransferorContract = await tokenTransferorFactory.deploy(
      routerAddress,
      linkAddress,
      {gasLimit: 1_000_000}
      );

    // const tokenTransferorContract = await ethers.getContractAt("TokenTransferor", "0x9382CBb6cFc219fe37A2d1f84BEbcE0CB9808F5d");
    console.log("tokenTransferorContract deployed to:", tokenTransferorContract.target);

    //After the deployment of the contract you need to transfer some CCIP-BnM tokens to the contract address.
    //You can do this by using the transfer function of the CCIP-BnM token contract.
    //first transfer some CCIP-BnM tokens to your wallet address using this website https://docs.chain.link/ccip/test-tokens
    //than transfer some CCIP-BnM tokens to the contract address using the transfer function of the CCIP-BnM token contract.

    const CCIPBnMTokenAddress = "0x01Ac06943d2B8327a7845235Ef034741eC1Da352";
    const CCIPBnMToken = await ethers.getContractAt(IERC20, CCIPBnMTokenAddress);
    const tokenTransferorAddress = tokenTransferorContract.target; // Address of the deployed contract
    const transferTx = await CCIPBnMToken.transfer(tokenTransferorAddress, 1000000000000000, { gasLimit: 1_000_000 });

    await transferTx.wait();
    console.log(`Transferred tokens to ${tokenTransferorAddress}`);

    //Your contract also need some Link in order to pay for the transaction to get some you can go here https://faucets.chain.link/
    const linkTokenAddress = "0x90a386d59b9A6a4795a011e8f032Fc21ED6FEFb6";
    const linkToken = await ethers.getContractAt(IERC20, linkTokenAddress);
    const linkTransferorAddress = tokenTransferorContract.target; // Address of the deployed contract
    const transferLinkTx = await linkToken.transfer(linkTransferorAddress, BigInt(5e18), { gasLimit: 1_000_000 });
    await transferLinkTx.wait();
    console.log(`Transferred Link to ${tokenTransferorAddress}`);

    //After the deployment of the contract you need to set the destination chain by calling the allowlistDestinationChain function
    const sepoliaIdDestinationChain = "16015286601757825753"; // Sepolia chain ID
    const allowDestinationChain = await tokenTransferorContract.allowlistDestinationChain(sepoliaIdDestinationChain, true, {gasLimit: 1_000_000});
    console.log("allowDestinationChain:", allowDestinationChain.hash);

    const receiverAddress = "0x208B15dab9903be8d34336d0B7f930E5f0a76eC5"; // Address of the receiver on Sepolia

    //you can then transfer some token 
    const transferToken = await tokenTransferorContract.transferTokensPayLINK(sepoliaIdDestinationChain, receiverAddress, CCIPBnMTokenAddress, 1000000000000000, {gasLimit: 1_000_000});
    console.log("transferToken:", transferToken.hash);

}

main();