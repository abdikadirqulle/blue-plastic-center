/**
 * The one money figure that stands for a record on a summary card.
 *
 * A document is worth its total, a party is worth what it still owes, an item
 * is worth the stock it carries. A record with no such figure — a chart of
 * accounts row, where adding assets to income would mean nothing — returns
 * undefined so it is left out of the sum instead of counted as zero.
 */
const valueFields = [
  "total",
  "amount",
  "openBalance",
  "inventoryValue",
  "contractAmount",
] as const;

export function recordValue(data: Record<string, unknown> | undefined) {
  const source = data ?? {};
  const field = valueFields.find((candidate) => {
    const value = source[candidate];
    return (
      value !== undefined &&
      value !== null &&
      value !== "" &&
      /^-?\d+(\.\d+)?$/.test(String(value))
    );
  });
  return field ? String(source[field]) : undefined;
}

export function summableValues(
  records: Array<{ data?: Record<string, unknown> }>,
) {
  return records
    .map((record) => recordValue(record.data))
    .filter((value): value is string => value !== undefined);
}
