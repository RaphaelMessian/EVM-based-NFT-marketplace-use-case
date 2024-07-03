//The purpose of this script is to demonstrate who to create - mint - transfer and listen to events created by HTS using precompiled contract.
const {ethers} = require("hardhat");


async function main() {
    signers = await ethers.getSigners(); 
    [deployer, otherWallet, treasury] = signers;

    const tokenCreateFactory = await ethers.getContractFactory(
        "FungiblePrecompiled"
        );
    const tokenCreateContract = await tokenCreateFactory.deploy(
      {gasLimit: 1_000_000}
      );
    const tokenCreateAddress = await tokenCreateContract.getAddress();
    // const tokenCreateCustomContract = await ethers.getContractAt("TokenCreateContract", "0xA093479E2E72985277e7d08845da7C74DeDCd49E");
    console.log("TokenCreateContract deployed to:", tokenCreateContract.target);

    //Create a fungible token with precompiled contract, all keys are set to the contract and the contract is the treasury
    //The token as an initial supply of 0 tokens a max supply of 10000 tokens and 8 decimals
    const createTokenTx = await tokenCreateContract.createFungibleTokenPublic(
      tokenCreateAddress,
      {
        value: '20000000000000000000', // = 20 hbars
        gasLimit: 1_000_000,
      }
    ); 
    const txReceipt = await createTokenTx.wait();
    const tokenAddress = txReceipt.logs.filter(
      (e) => e.fragment.name === "CreatedToken"
    )[0].args[0];
    console.log("Token created at address", tokenAddress);

    //Since the contract is defined as the supplykey, we can mint tokens
    //Here we mint 100 new tokens to the treasury -> the contract, new totalsupply is 1100
    const mintTokenTx = await tokenCreateContract.mintTokenPublic(
      tokenAddress,
      100,
      [],
      {
        gasLimit: 1_000_000,
      }
    );
    const mintFungibleTokenReceipt = await mintTokenTx.wait();
    const { newTotalSupply } = mintFungibleTokenReceipt.logs.filter(
      (e) => e.fragment.name === "MintedToken"
    )[0].args;
    console.log("Minted 100 tokens to treasury", newTotalSupply);

    //We can transfer tokens from the treasury to another account, first the account need to associate the token
    //We will use the IHRC719 so that an account can associate a token using a smart contract
    const associateTokenInterface = await ethers.getContractAt("IHRC719", tokenAddress)
    const associateTokenTx = await associateTokenInterface.associate(
      {
        gasLimit: 1_000_000,
      }
    );
    console.log("Token associated to account tx hash", associateTokenTx.hash);

    //We can now transfer tokens from the treasury to another account
    const transferTokenTx = await tokenCreateContract.transferTokensPublic(
      tokenAddress,
      [tokenCreateAddress, deployer.address],
      [-10, 10],
      {
        gasLimit: 1_000_000,
      }
    );
    console.log("Token transfer tx hash", transferTokenTx.hash);

    //We can use the ERC20 interface also to interact with the token
    const tokenInterface = await ethers.getContractAt("IERC20", tokenAddress);
    const balanceOfDeployer = await tokenInterface.balanceOf(deployer.address);
    console.log("Balance of deployer", balanceOfDeployer.toString());
}

main();