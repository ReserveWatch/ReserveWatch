# Stellar commodity tokens

Classic assets are read from Horizon (`STELLAR_HORIZON_URL`, default `https://horizon.stellar.org`): supply, trustline count, and issuer flags AUTH_REQUIRED, AUTHORIZATION_REVOCABLE, and CLAWBACK. SEP-41 supply is a Soroban `total_supply` call (`STELLAR_SOROBAN_RPC_URL`, default `https://mainnet.sorobanrpc.com`). If that call does not return a number, supply is **not available**. SEP-41 holder counts and contract controls (blocklist, forced transfer) are **not available** and are not penalties.

Price vs spot is not available.

| Token | Kind | Address | Source |
| --- | --- | --- | --- |
| XAUm (Matrixdock) | SEP-41 contract | `CC2RBGYNCFBCVENIDL5BFBWPH4OUZM2UA3OD2K2N54GLMWCC4KWPVAGO` | https://stellar.expert/explorer/public/contract/CC2RBGYNCFBCVENIDL5BFBWPH4OUZM2UA3OD2K2N54GLMWCC4KWPVAGO (source repo Matrixdock-RWA/RWA-Contracts) |
| VNXAU (VNX) | Classic asset | `VNXAU` issued by `GCKIYYQVIFBIFDRN7BNDNHL3UZSFHT5NHDAISG2N3MWCZY3WNXL3LXN3` | https://vnx.gitbook.io/vnx-platform/vnx-gold/token-details |

ReserveWatch has not checked any vault.
