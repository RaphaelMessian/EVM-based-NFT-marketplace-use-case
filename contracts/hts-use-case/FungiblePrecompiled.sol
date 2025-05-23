// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.5.0 <0.9.0;
pragma experimental ABIEncoderV2;

import "../system-contracts/hedera-token-service/HederaTokenService.sol";
import "../system-contracts/hedera-account-service/HederaAccountService.sol";
import "../system-contracts/hedera-token-service/ExpiryHelper.sol";
import "../system-contracts/hedera-token-service/KeyHelper.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract FungiblePrecompiled is HederaTokenService, HederaAccountService, ExpiryHelper, KeyHelper {

    string name = "tokenName";
    string symbol = "tokenSymbol";
    string memo = "memo";
    int64 initialTotalSupply = 0;
    int64 maxSupply = 0;
    int32 decimals = 8;
    bool freezeDefaultStatus = false;

    event ResponseCode(int responseCode);
    event CreatedToken(address tokenAddress);
    event MintedToken(int64 newTotalSupply, int64[] serialNumbers);
    event TokenType(int32 tokenType);
    
    struct FixFeeParams {
        address feeCollector;
        bool isFractionalFee;
        bool isFixedFee;
        int64 feeAmount;
        address fixedFeeTokenAddress;
        bool useHbarsForPayment;
        bool useCurrentTokenForPayment;
        bool isMultipleFixedFee;
        address feeCollector2;
        address secondFixedFeeTokenAddress;
        bool useHbarsForPaymentSecondFixFee;
        bool useCurrentTokenForPaymentSecondFixFee;
    }

    function createFungibleTokenPublic(
        address treasury
    ) public payable {

        IHederaTokenService.TokenKey[] memory keys = new IHederaTokenService.TokenKey[](2); 
        keys[0] = getSingleKey(KeyType.ADMIN, KeyValueType.INHERIT_ACCOUNT_KEY, bytes(""));
        keys[1] = getSingleKey(KeyType.SUPPLY, KeyValueType.INHERIT_ACCOUNT_KEY, bytes(""));

        IHederaTokenService.Expiry memory expiry = IHederaTokenService.Expiry(
            0, treasury, 8000000
        );

        IHederaTokenService.HederaToken memory token = IHederaTokenService.HederaToken(
            name, symbol, treasury, memo, false, maxSupply, freezeDefaultStatus, keys, expiry
        );
        
        (int responseCode, address tokenAddress) =
        HederaTokenService.createFungibleToken(token, initialTotalSupply, decimals);

        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert ();
        }
        emit CreatedToken(tokenAddress);
    }

    function createFungibleTokenWithCustomFeePublic(
        address treasury,
        address feeCollector,
        bool isFractionalFee,
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
            name, symbol, treasury, memo, true, maxSupply, false, keys, expiry
        );

        IHederaTokenService.FixedFee[] memory fixedFees = new IHederaTokenService.FixedFee[](1);

        if(isFixedFee) {
            fixedFees[0] = IHederaTokenService.FixedFee(feeAmount, fixedFeeTokenAddress, useHbarsForPayment, useCurrentTokenForPayment, feeCollector);
        } else {
             fixedFees = new IHederaTokenService.FixedFee[](0);
        }

        IHederaTokenService.FractionalFee[] memory fractionalFees = new IHederaTokenService.FractionalFee[](1);

        if(isFractionalFee) {
            fractionalFees[0] = IHederaTokenService.FractionalFee(1, 10, 1e8, 30e8, false, treasury);
        } else {
            fractionalFees = new IHederaTokenService.FractionalFee[](0);
        }

        (int responseCode, address tokenAddress) =
        HederaTokenService.createFungibleTokenWithCustomFees(token, initialTotalSupply, decimals, fixedFees, fractionalFees);
        emit ResponseCode(responseCode);

        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert ();
        }

        emit CreatedToken(tokenAddress);
    }

    function createFungibleTokenWithMultipleCustomFeePublic(
        address treasury,
        FixFeeParams memory params
    ) public payable {

        IHederaTokenService.TokenKey[] memory keys = new IHederaTokenService.TokenKey[](2);
        keys[0] = getSingleKey(KeyType.ADMIN, KeyValueType.INHERIT_ACCOUNT_KEY, bytes(""));
        keys[1] = getSingleKey(KeyType.SUPPLY, KeyValueType.INHERIT_ACCOUNT_KEY, bytes(""));

        IHederaTokenService.Expiry memory expiry = IHederaTokenService.Expiry(
            0, treasury, 8000000
        );

        IHederaTokenService.HederaToken memory token = IHederaTokenService.HederaToken(
            name, symbol, treasury, memo, true, maxSupply, false, keys, expiry
        );

        IHederaTokenService.FixedFee[] memory fixedFees = new IHederaTokenService.FixedFee[](2);

        if(params.isFixedFee) {
            if(params.isMultipleFixedFee) {
                fixedFees = new IHederaTokenService.FixedFee[](2);
            } else {
                fixedFees = new IHederaTokenService.FixedFee[](1);
            }
        fixedFees[0] = IHederaTokenService.FixedFee(params.feeAmount, params.fixedFeeTokenAddress, params.useHbarsForPayment, params.useCurrentTokenForPayment, params.feeCollector);
            if(params.isMultipleFixedFee) {
        fixedFees[1] = IHederaTokenService.FixedFee(params.feeAmount, params.secondFixedFeeTokenAddress, params.useHbarsForPaymentSecondFixFee, params.useCurrentTokenForPaymentSecondFixFee, params.feeCollector2);
            }
        } else {
            fixedFees = new IHederaTokenService.FixedFee[](0);
        }

        IHederaTokenService.FractionalFee[] memory fractionalFees = new IHederaTokenService.FractionalFee[](1);

        if(params.isFractionalFee) {
            fractionalFees[0] = IHederaTokenService.FractionalFee(1, 10, 1e8, 30e8, false, params.feeCollector);
        } else {
            fractionalFees = new IHederaTokenService.FractionalFee[](0);
        }

        (int responseCode, address tokenAddress) =
        HederaTokenService.createFungibleTokenWithCustomFees(token, initialTotalSupply, decimals, fixedFees, fractionalFees);
        emit ResponseCode(responseCode);

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

    function associateTokenPublic(address account, address token) public returns (int responseCode) {
        responseCode = HederaTokenService.associateToken(account, token);
        emit ResponseCode(responseCode);

        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert ();
        }
    }

    function approvePublic(address token, address spender, uint256 amount) public returns (int responseCode) {
        responseCode = HederaTokenService.approve(token, spender, amount);
        emit ResponseCode(responseCode);

        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert ();
        }
    }

    function transferTokensPublic(address token, address[] memory accountId, int64[] memory amount) external returns (int256 responseCode) {
        responseCode = HederaTokenService.transferTokens(token, accountId, amount);
        emit ResponseCode(responseCode);

        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert ();
        }
    }

    function transferFromERC20(address token, address sender, address recipient, uint256 amount) external returns (bool) {
        return IERC20(token).transferFrom(sender, recipient, amount);
    }

    function approveFromERC20(address token, address spender, uint256 amount) external returns (bool) {
        return IERC20(token).approve(spender, amount);
    }

    function approveHbarTransfer( address spender, int256 amount) external returns (int) {
        return HederaAccountService.hbarApprove(address(this), spender, amount);
    }

    function getTokenTypePublic(address token) public returns (int64 responseCode, int32 tokenType) {
        (responseCode, tokenType) = HederaTokenService.getTokenType(token);
        emit ResponseCode(responseCode);

        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert();
        }

        emit TokenType(tokenType);
    }
}
