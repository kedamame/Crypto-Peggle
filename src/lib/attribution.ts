// ERC-8021 builder attribution — lets Base Build track on-chain txs from this app.
// Builder code issued by Base Build for DotShot.
// - submitScore uses Schema 0 via DATA_SUFFIX (viem dataSuffix)
// - x402 continue/extra uses Schema 2 via @x402/extensions/builder-code (`a` / `s`)
import { Attribution } from 'ox/erc8021';

export const BUILDER_CODE = 'bc_1pm68wo8';

// Data suffix appended to tx calldata. Contracts ignore trailing bytes, so this is
// safe for any tx. Resolves to: 0x62635f31706d3638776f380b00...80218021 (schema 0).
export const DATA_SUFFIX = Attribution.toDataSuffix({ codes: [BUILDER_CODE] });
