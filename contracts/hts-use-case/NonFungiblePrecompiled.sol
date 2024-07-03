// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.5.0 <0.9.0;
pragma experimental ABIEncoderV2;

import "../precompile/hedera-token-service/HederaTokenService.sol";
import "../precompile/hedera-token-service/ExpiryHelper.sol";
import "../precompile/hedera-token-service/KeyHelper.sol";

contract NonFungiblePrecompiled is HederaTokenService, ExpiryHelper, KeyHelper {

    string name = "tokenName";
    string symbol = "tokenSymbol";
    string memo = "memo";
    int64 initialTotalSupply = 1000;
    int64 maxSupply = 10000;
    int32 decimals = 8;
    bool freezeDefaultStatus = false;

    event ResponseCode(int responseCode);
    event CreatedToken(address tokenAddress);
    event MintedToken(int64 newTotalSupply, int64[] serialNumbers);

    function createNonFungibleTokenPublic(
        address treasury
    ) public payable {
        IHederaTokenService.TokenKey[] memory keys = new IHederaTokenService.TokenKey[](2);
        keys[0] = getSingleKey(KeyType.ADMIN, KeyValueType.INHERIT_ACCOUNT_KEY, bytes(""));
        keys[1] = getSingleKey(KeyType.SUPPLY, KeyValueType.INHERIT_ACCOUNT_KEY, bytes(""));


        IHederaTokenService.Expiry memory expiry = IHederaTokenService.Expiry(
            0, treasury, 8000000
        );

        IHederaTokenService.HederaToken memory token = IHederaTokenService.HederaToken(
            name, symbol, treasury, memo, true, maxSupply, freezeDefaultStatus, keys, expiry
        );

        (int responseCode, address tokenAddress) =
        HederaTokenService.createNonFungibleToken(token);

        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert ();
        }

        emit CreatedToken(tokenAddress);
    }

    function createNonFungibleTokenWithCustomFeesPublic(
        address treasury,
        address feeCollector,
        bool isRoyaltyFee,
        bool isFixedFee,
        int64 feeAmount,
        address fixedFeeTokenAddress,
        bool useHbarsForPayment,
        bool useCurrentTokenForPayment
    ) public payable {
        IHederaTokenService.TokenKey[] memory keys = new IHederaTokenService.TokenKey[](2);
        keys[0] = getSingleKey(KeyType.ADMIN, KeyValueType.INHERIT_ACCOUNT_KEY, bytes(""));
        keys[1] = getSingleKey(KeyType.SUPPLY, KeyValueType.INHERIT_ACCOUNT_KEY, bytes(""));


        IHederaTokenService.Expiry memory expiry = IHederaTokenService.Expiry(
            0, treasury, 8000000
        );

        IHederaTokenService.HederaToken memory token = IHederaTokenService.HederaToken(
            name, symbol, treasury, memo, true, maxSupply, freezeDefaultStatus, keys, expiry
        );

        IHederaTokenService.FixedFee[] memory fixedFees = new IHederaTokenService.FixedFee[](1);
        if(isFixedFee) {
            fixedFees[0] = IHederaTokenService.FixedFee(feeAmount, fixedFeeTokenAddress, useHbarsForPayment, useCurrentTokenForPayment, feeCollector);
        } else {
             fixedFees = new IHederaTokenService.FixedFee[](0);
        }

        IHederaTokenService.RoyaltyFee[] memory royaltyFees = new IHederaTokenService.RoyaltyFee[](1);
        if(isRoyaltyFee) {
             royaltyFees[0] = IHederaTokenService.RoyaltyFee(1, 10, 1e4, address(0), true, treasury);
        } else {
             royaltyFees = new IHederaTokenService.RoyaltyFee[](0);
        }

        (int responseCode, address tokenAddress) =
        HederaTokenService.createNonFungibleTokenWithCustomFees(token, fixedFees, royaltyFees);

        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert ();
        }

        emit CreatedToken(tokenAddress);
    }

    function mintTokenPublic(address token, int64 amount, bytes[] memory metadata) public
    returns (int responseCode, int64 newTotalSupply, int64[] memory serialNumbers)  {
        (responseCode, newTotalSupply, serialNumbers) = HederaTokenService.mintToken(token, amount, metadata);
        emit ResponseCode(responseCode);

        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert();
        }

        emit MintedToken(newTotalSupply, serialNumbers);
    }

    function mintTokenToAddressPublic(address token, int64 amount, bytes[] memory metadata) public
    returns (int responseCode, int64 newTotalSupply, int64[] memory serialNumbers)  {
        (responseCode, newTotalSupply, serialNumbers) = HederaTokenService.mintToken(token, amount, metadata);
        emit ResponseCode(responseCode);

        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert();
        }

        emit MintedToken(newTotalSupply, serialNumbers);

        HederaTokenService.transferNFT(token, address(this), msg.sender, serialNumbers[0]);
    }

    function associateTokenPublic(address account, address token) public returns (int responseCode) {
        responseCode = HederaTokenService.associateToken(account, token);
        emit ResponseCode(responseCode);

        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert ();
        }
    }

     function approveNFTPublic(address token, address approved, uint256 serialNumber) public returns (int responseCode) {
        responseCode = HederaTokenService.approveNFT(token, approved, serialNumber);
        emit ResponseCode(responseCode);

        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert ();
        }
    }

    function transferNFTsPublic(address token, address[] memory sender, address[] memory receiver, int64[] memory serialNumber) external returns (int256 responseCode) {
        responseCode = HederaTokenService.transferNFTs(token, sender, receiver, serialNumber);
        emit ResponseCode(responseCode);

        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert ();
        }
    }

    function cryptoTransferPublic(IHederaTokenService.TransferList calldata transferList, IHederaTokenService.TokenTransferList[] calldata tokenTransferList) public returns (int responseCode) {
        responseCode = HederaTokenService.cryptoTransfer(transferList, tokenTransferList);
        emit ResponseCode(responseCode);

        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert();
        }
    }
}
