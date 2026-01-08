/**
 * CEP-18 Token Client
 * Provides methods for interacting with CEP-18 compatible tokens on Casper
 *
 * NOTE: This is a stub implementation. The token interaction methods
 * will be fully implemented once the contract is deployed.
 */

import { PublicKey } from "casper-js-sdk";

/**
 * Client for interacting with CEP-18 tokens
 * Currently a stub - will be implemented when contract is deployed
 */
export class TokenClient {
  constructor(_contractHash?: string, _rpcUrl?: string) {}

  async balanceOf(_ownerPublicKey: string): Promise<bigint> {
    return BigInt(0);
  }

  async allowance(_ownerPublicKey: string, _spenderHash: string): Promise<bigint> {
    return BigInt(0);
  }

  async name(): Promise<string> {
    return "Ghost Token";
  }

  async symbol(): Promise<string> {
    return "GHOST";
  }

  async decimals(): Promise<number> {
    return 9;
  }

  async totalSupply(): Promise<bigint> {
    return BigInt(0);
  }

  approve(
    _senderPublicKey: PublicKey,
    _spenderHash: string,
    _amount: bigint
  ): unknown {
    throw new Error("Token client not yet implemented");
  }

  transfer(
    _senderPublicKey: PublicKey,
    _recipientPublicKey: PublicKey,
    _amount: bigint
  ): unknown {
    throw new Error("Token client not yet implemented");
  }

  transferFrom(
    _senderPublicKey: PublicKey,
    _ownerPublicKey: PublicKey,
    _recipientPublicKey: PublicKey,
    _amount: bigint
  ): unknown {
    throw new Error("Token client not yet implemented");
  }

  async sendDeploy(_signedDeploy: unknown): Promise<string> {
    throw new Error("Token client not yet implemented");
  }

  formatAmount(amount: bigint, decimals: number = 9): string {
    const divisor = BigInt(10 ** decimals);
    const wholePart = amount / divisor;
    const fractionalPart = amount % divisor;

    if (fractionalPart === BigInt(0)) {
      return wholePart.toString();
    }

    const fractionalStr = fractionalPart.toString().padStart(decimals, "0");
    const trimmedFractional = fractionalStr.replace(/0+$/, "");

    return `${wholePart}.${trimmedFractional}`;
  }

  parseAmount(amountStr: string, decimals: number = 9): bigint {
    const [whole, fraction = ""] = amountStr.split(".");
    const paddedFraction = fraction.padEnd(decimals, "0").slice(0, decimals);
    return BigInt(whole + paddedFraction);
  }
}

export const tokenClient = new TokenClient();
