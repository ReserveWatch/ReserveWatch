# Solana commodity tokens

Supply and mint or freeze authority are read from a public Solana RPC (`SOLANA_RPC_URL`, default `https://api.mainnet-beta.solana.com`) with `getTokenSupply` and `getAccountInfo`. Holder counts are **not available** unless `SOLANA_INDEXER_URL` is set. The public RPC blocks `getProgramAccounts`. A missing holder count is not a penalty.

Price vs spot is not available. The public spot gold price is context only.

Left out: Oro Gold (no mint address confirmed from the issuer or a Solana token list). GLDx, SLVon, and SLVx are tokenized ETF shares, not a direct metal claim, so they are not listed.

| Token | Mint | Bridged | Source |
| --- | --- | --- | --- |
| PAXG (Paxos) | `5GgRAEmv8ZxF2PR5hY72Qs5x1bnQ6UK2RbTPoqJ3wSwW` | no | https://docs.paxos.com/guides/stablecoin/paxg/mainnet |
| XAUT0 (Tether) | `AymATz4TCL9sWNEEV9Kvyz45CHVhDZ6kUgjTJPzLpU9P` | yes | https://docs.usdt0.to/technical-documentation/developer |
| XAUm (Matrixdock) | `5aLhp9VnUEKcsdtkfsf2DUgpJfomx7GmYVny24dHUZoB` | no | https://tokens.solana.com/gold?solana=5aLhp9VnUEKcsdtkfsf2DUgpJfomx7GmYVny24dHUZoB |
| DGLD (Gold Token SA) | `dg1dmo6NZNagkwB6EAfUeaco6CFXFLRhb1KCrsqXTVz` | no | https://dgld.ch/ |
| VNXAU (VNX) | `9TPL8droGJ7jThsq4momaoz6uhTcvX2SeMqipoPmNa8R` | no | https://vnx.gitbook.io/vnx-platform/vnx-gold/token-details |

Paxos says the PAXG mint is one fine troy ounce. Tether's XAUt0 docs list the Solana token as the LayerZero OFT form of Tether Gold. DGLD's site lists the Solana mint and says that supply is native, not bridged. VNX says one VNXAU token is one gram. ReserveWatch has not checked any vault.
