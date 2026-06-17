/**
 * Format a monetary amount with the given currency code and optional exchange rate.
 * The exchange rate multiplies the stored USD base value for display in the selected currency.
 * Uses 0 decimal places for high-rate currencies (rate >= 100, e.g. LBP), 2 otherwise.
 *
 * e.g. fmtMoney(1.5, "LBP", 89500) → "LBP 134,250"
 *      fmtMoney(1.5, "USD", 1)      → "USD 1.50"
 */
export function fmtMoney(amount, currency = "USD", rate = 1) {
  const v   = (parseFloat(amount ?? 0)) * rate;
  const dec = rate >= 100 ? 0 : 2;
  return `${currency} ${v.toLocaleString("en", { minimumFractionDigits: dec, maximumFractionDigits: dec })}`;
}

/**
 * Compact form — rounds to nearest integer, for stat-card numbers.
 * e.g. fmtMoneyRound(12345.6, "LBP", 89500) → "LBP 1,104,615,000"
 */
export function fmtMoneyRound(amount, currency = "USD", rate = 1) {
  const v = Math.round((parseFloat(amount ?? 0)) * rate);
  return `${currency} ${v.toLocaleString("en")}`;
}
