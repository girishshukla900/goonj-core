// Money is always integer paise. Never floats.

export const CREATOR_SHARE = 0.90;

export function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

/**
 * Split a gross amount into creator and platform shares.
 * Rounding favours the creator; the two parts always sum back to gross exactly.
 */
export function split(grossPaise) {
  if (!Number.isInteger(grossPaise) || grossPaise <= 0) {
    throw badRequest('gross_paise must be a positive integer');
  }
  const creator = Math.round(grossPaise * CREATOR_SHARE);
  const platform = grossPaise - creator;
  return { creator, platform };
}

export function toPaise(rupees) {
  return Math.round(Number(rupees) * 100);
}

export function toRupees(paise) {
  return +(paise / 100).toFixed(2);
}
