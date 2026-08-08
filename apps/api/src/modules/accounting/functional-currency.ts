import { conflict } from "../../platform/errors.js"
import { assertBalanced } from "./ledger-math.js"

export interface TransactionAmountLine {
  debit: string
  credit: string
}

/**
 * Establishes explicit functional amounts without inventing FX semantics.
 * Until conversion is implemented, transaction and functional amounts are
 * necessarily identical and both journals must balance exactly at scale 4.
 */
export function prepareSameCurrencyFunctionalAmounts<T extends TransactionAmountLine>(
  transactionCurrency: string,
  functionalCurrency: string,
  lines: T[],
) {
  if (transactionCurrency !== functionalCurrency) {
    throw conflict(
      `Foreign-currency GL conversion is not enabled: transaction currency ${transactionCurrency} does not match functional currency ${functionalCurrency}`,
    )
  }

  assertBalanced(lines as unknown as Array<Record<string, unknown>>)
  const prepared = lines.map((line) => ({
    ...line,
    functionalDebit: line.debit,
    functionalCredit: line.credit,
  }))
  assertBalanced(prepared.map((line) => ({
    debit: line.functionalDebit,
    credit: line.functionalCredit,
  })))
  return prepared
}
