//The purpose of this script is to demonstrate how to create a fungible token with both fees using the precompiled contract
//The token is created with a fixed fee of 1 hbars for the feeCollector account and 10% fractionnal fee for the treasury, the treasury is the contract and the contract is the supply key
const {ethers} = require("hardhat");

async function main() {
    signers = await ethers.getSigners(); 
    [deployer, otherWallet, feeCollector] = signers;

    const tokenCreateFactory = await ethers.getContractFactory(
        "FungiblePrecompiled"
        );
    const tokenCreateContract = await tokenCreateFactory.deploy(
      {gasLimit: 1_000_000}
      );
    const tokenCreateAddress = await tokenCreateContract.getAddress();
    console.log("TokenCreateContract deployed to:", tokenCreateAddress);
    //const tokenCreateCustomContract = await ethers.getContractAt("FungiblePrecompiled", "0x1f61337E6b8837E75F64466b9618C986f3e571B9");

    //Create a fungible token with precompiled contract, all keys are set to the contract and the contract is the treasury
    //The token as an initial supply of 0 tokens a max supply of 10000 tokens and 8 decimals
    const createTokenTx = await tokenCreateContract.createFungibleTokenWithCustomFeePublic(
      tokenCreateAddress, // treasury
      feeCollector.address, // feeCollector
      true, // isFractional
      true, // isFixed
      1e8,  // amount for fixedFee
      '0x0000000000000000000000000000000000000000', //address for token of fixedFee, if set to 0x0, the fee will be in hbars
      true, // if true the fee will be in Hbar
      false, // if true use the current token for fixed fee

      {
        value: '30000000000000000000', // = 30 hbars
        gasLimit: 3_000_000,
      }
    ); 
    const createTokenReceipt = await createTokenTx.wait();
    const tokenAddress = createTokenReceipt.logs.filter(
      (e) => e.fragment.name === "CreatedToken"
    )[0].args[0];
    console.log("Token created at address", tokenAddress);

    //Since the contract is defined as the supplykey, we can mint tokens
    //Here we mint 100 new tokens to the treasury -> the contract, new totalsupply is 100
    const mintTokenTx = await tokenCreateContract.mintTokenPublic(
      tokenAddress,
      100e8,
      [], // = 10 hbars
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
      [-100e8, 100e8],
      {
        gasLimit: 1_000_000,
      }
    );
    console.log("Token transfer tx hash", transferTokenTx.hash);

    //We can use the ERC20 interface also to interact with the token
    const tokenInterface = await ethers.getContractAt("IERC20", tokenAddress);
    const balanceOfDeployer = await tokenInterface.balanceOf(deployer.address);
    console.log("Balance of deployer", balanceOfDeployer.toString());

    //Here since the transfer is from the treasury, the fees are not applied
    //If we want the fee to be applied the transfer must take place between 2 accounts that are not part of the feeCollector.

    // let associate first the token with the otherWallet
    const associateTokenWithOWTx = await associateTokenInterface.connect(otherWallet).associate(
      {
        gasLimit: 1_000_000,
      }
    );
    console.log("Token associated to account tx hash", associateTokenWithOWTx.hash);

    //Since we want to use the transferTokensPublic function, we need to approve the contract to spend the tokens
    const approveContract = await tokenInterface.approve(tokenCreateAddress, 100e8, {gasLimit: 1_000_000});
    console.log("Approval tx hash", approveContract.hash);
    const approveContractReceipt = await approveContract.wait();
    const event = approveContractReceipt.logs.map(
      (e) => e.fragment.name === 'Approval' && e
    )[0];
    const [owner, spender, allowance] = event.args;
    console.log("Owner: ", owner, " Spender: ", spender, " Allowance: ", allowance.toString());

    //Balance of the feeCollector and contract before transfer
    const feeCollectorBalanceBeforeTransfer = await ethers.provider.getBalance(feeCollector.address);
    console.log("Balance of feeCollector before the Transfer", feeCollectorBalanceBeforeTransfer.toString());
    const contractTokenBalanceBeforeTransfer = await tokenInterface.balanceOf(tokenCreateAddress);
    console.log("Token balance of contract before the Transfer", contractTokenBalanceBeforeTransfer.toString());

    //We can now transfer tokens from the deployer to another account
    const transferTokenToOWTx = await tokenCreateContract.transferTokensPublic(
      tokenAddress,
      [deployer.address, otherWallet.address],
      [-100e8, 100e8],
      {
        gasLimit: 1_000_000,
      }
    );
    console.log("Token transfer tx hash", transferTokenToOWTx.hash);

    //Balance of the otherWallet should be 100
    const balanceOfOW = await tokenInterface.balanceOf(otherWallet.address);
    console.log("Balance of deployer", balanceOfOW.toString());

    //Balance should be increase by 1Hbar
    const feeCollectorBalanceAfterTransfer = await ethers.provider.getBalance(feeCollector.address);
    console.log("Hbar balance of feeCollector after the Transfer", feeCollectorBalanceAfterTransfer.toString());

    //Balance should be 10% of the amount transferred
    const contractTokenBalanceAfterTransfer = await tokenInterface.balanceOf(tokenCreateAddress);
    console.log("Token balance of contract after the Transfer", contractTokenBalanceAfterTransfer.toString());
 
}

main();