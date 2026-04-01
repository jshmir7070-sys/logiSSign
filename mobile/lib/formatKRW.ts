/**
 * Format a number as Korean Won currency string.
 * @param amount - The numeric amount to format
 * @returns Formatted string like "₩1,234,567"
 */
export function formatKRW(amount: number): string {
  return `₩${amount.toLocaleString('ko-KR')}`;
}

/**
 * Format a number as Korean Won with "원" suffix.
 * @param amount - The numeric amount to format
 * @returns Formatted string like "1,234,567원"
 */
export function formatKRWWithSuffix(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`;
}
