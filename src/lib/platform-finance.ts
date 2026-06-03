/** Platform fee applied to organizer finance summaries (e.g. 6% processing). */
export const PLATFORM_FEE_RATE = 0.06;

export function netAfterPlatformFee(gross: number): number {
  return Math.round(gross * (1 - PLATFORM_FEE_RATE));
}
