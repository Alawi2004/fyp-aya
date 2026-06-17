/**
 * Format a monetary amount with the given currency code.
 * e.g. fmtMoney(1234.5, "USD") → "USD 1,234.50"
 *      fmtMoney(850,    "OMR") → "OMR 850.00"
 */
export function fmtMoney(amount, currency = "USD") {
  const n = parseFloat(amount ?? 0);
  return `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Compact form — no decimals, for large stat-card numbers.
 * e.g. fmtMoneyRound(12345, "USD") → "USD 12,345"
 */
export function fmtMoneyRound(amount, currency = "USD") {
  const n = Math.round(parseFloat(amount ?? 0));
  return `${currency} ${n.toLocaleString()}`;
}
