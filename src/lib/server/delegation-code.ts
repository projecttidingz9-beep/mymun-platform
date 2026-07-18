import { randomInt } from "crypto";

const DELEGATION_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const DELEGATION_CODE_LENGTH = 10;

export function generateDelegationCode(): string {
  return Array.from(
    { length: DELEGATION_CODE_LENGTH },
    () => DELEGATION_CODE_ALPHABET[randomInt(DELEGATION_CODE_ALPHABET.length)]
  ).join("");
}
