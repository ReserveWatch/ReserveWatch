// Commodity tokens on Solana and Stellar. Addresses come from the issuer or a public token list.
// Listed here only. XRPL tokens stay in src/config/tokens.ts. This file does not read the network.

export type ChainLedger = 'solana' | 'stellar';

export interface ChainToken {
  id: string;
  ledger: ChainLedger;
  name: string;
  project: string;
  displayCode: string;
  /** 1 for a gram token, 31.1034768 for one troy ounce. */
  gramsPerToken: number;
  /** Solana mint, Stellar contract id, or classic asset code. */
  address: string;
  /** Classic Stellar issuer account. */
  issuer?: string;
  kind: 'mint' | 'sep41' | 'classic';
  bridged: boolean;
  website: string;
  sourceUrl: string;
  explorerUrl: string;
  notes: string[];
}

export const CHAIN_TOKENS: ChainToken[] = [
  {
    id: 'solana-paxg',
    ledger: 'solana',
    name: 'PAX Gold (PAXG)',
    project: 'Paxos',
    displayCode: 'PAXG',
    gramsPerToken: 31.1034768,
    address: '5GgRAEmv8ZxF2PR5hY72Qs5x1bnQ6UK2RbTPoqJ3wSwW',
    kind: 'mint',
    bridged: false,
    website: 'https://www.paxos.com/pax-gold',
    sourceUrl: 'https://docs.paxos.com/guides/stablecoin/paxg/mainnet',
    explorerUrl: 'https://solscan.io/token/5GgRAEmv8ZxF2PR5hY72Qs5x1bnQ6UK2RbTPoqJ3wSwW',
    notes: [
      'Paxos lists this Solana mint as PAXG on Solana mainnet. Paxos says each token is for one fine troy ounce of gold.',
      'Paxos also publishes a LayerZero OFT store for this mint. ReserveWatch has not checked any vault.',
    ],
  },
  {
    id: 'solana-xaut0',
    ledger: 'solana',
    name: 'Tether Gold (XAUT0)',
    project: 'Tether',
    displayCode: 'XAUT0',
    gramsPerToken: 31.1034768,
    address: 'AymATz4TCL9sWNEEV9Kvyz45CHVhDZ6kUgjTJPzLpU9P',
    kind: 'mint',
    bridged: true,
    website: 'https://gold.tether.to/',
    sourceUrl: 'https://docs.usdt0.to/technical-documentation/developer',
    explorerUrl: 'https://solscan.io/token/AymATz4TCL9sWNEEV9Kvyz45CHVhDZ6kUgjTJPzLpU9P',
    notes: [
      'Tether\'s XAUt0 docs list this address as the Solana token for the LayerZero OFT form of Tether Gold.',
      'It is a bridged representation. ReserveWatch has not checked the gold.',
    ],
  },
  {
    id: 'solana-xaum',
    ledger: 'solana',
    name: 'Matrixdock Gold (XAUm)',
    project: 'Matrixdock',
    displayCode: 'XAUm',
    gramsPerToken: 31.1034768,
    address: '5aLhp9VnUEKcsdtkfsf2DUgpJfomx7GmYVny24dHUZoB',
    kind: 'mint',
    bridged: false,
    website: 'https://www.matrixdock.com/',
    sourceUrl: 'https://tokens.solana.com/gold?solana=5aLhp9VnUEKcsdtkfsf2DUgpJfomx7GmYVny24dHUZoB',
    explorerUrl: 'https://solscan.io/token/5aLhp9VnUEKcsdtkfsf2DUgpJfomx7GmYVny24dHUZoB',
    notes: [
      'The Solana token list names this mint Matrixdock Gold (XAUm). Matrixdock says each XAUm token stands for one troy ounce of gold.',
      'ReserveWatch has not checked the gold.',
    ],
  },
  {
    id: 'solana-dgld',
    ledger: 'solana',
    name: 'DGLD',
    project: 'Gold Token SA',
    displayCode: 'DGLD',
    gramsPerToken: 31.1034768,
    address: 'dg1dmo6NZNagkwB6EAfUeaco6CFXFLRhb1KCrsqXTVz',
    kind: 'mint',
    bridged: false,
    website: 'https://dgld.ch/',
    sourceUrl: 'https://dgld.ch/',
    explorerUrl: 'https://solscan.io/token/dg1dmo6NZNagkwB6EAfUeaco6CFXFLRhb1KCrsqXTVz',
    notes: [
      'Gold Token SA lists this mint on dgld.ch as the Solana Token-2022 deployment. The issuer says supply on Solana is native, not bridged from Ethereum.',
      'The issuer says each token maps to one fine troy ounce. ReserveWatch has not checked the gold.',
    ],
  },
  {
    id: 'solana-vnxau',
    ledger: 'solana',
    name: 'VNX Gold (VNXAU)',
    project: 'VNX',
    displayCode: 'VNXAU',
    gramsPerToken: 1,
    address: '9TPL8droGJ7jThsq4momaoz6uhTcvX2SeMqipoPmNa8R',
    kind: 'mint',
    bridged: false,
    website: 'https://vnx.li/',
    sourceUrl: 'https://vnx.gitbook.io/vnx-platform/vnx-gold/token-details',
    explorerUrl: 'https://solscan.io/token/9TPL8droGJ7jThsq4momaoz6uhTcvX2SeMqipoPmNa8R',
    notes: [
      'VNX lists this Solana address for VNX Gold. VNX says one token is one gram of gold.',
      'ReserveWatch has not checked the gold.',
    ],
  },
  {
    id: 'stellar-xaum',
    ledger: 'stellar',
    name: 'Matrixdock Gold (XAUm)',
    project: 'Matrixdock',
    displayCode: 'XAUm',
    gramsPerToken: 31.1034768,
    address: 'CC2RBGYNCFBCVENIDL5BFBWPH4OUZM2UA3OD2K2N54GLMWCC4KWPVAGO',
    kind: 'sep41',
    bridged: false,
    website: 'https://www.matrixdock.com/',
    sourceUrl: 'https://stellar.expert/explorer/public/contract/CC2RBGYNCFBCVENIDL5BFBWPH4OUZM2UA3OD2K2N54GLMWCC4KWPVAGO',
    explorerUrl: 'https://stellar.expert/explorer/public/contract/CC2RBGYNCFBCVENIDL5BFBWPH4OUZM2UA3OD2K2N54GLMWCC4KWPVAGO',
    notes: [
      'StellarExpert lists this contract as Matrixdock XAUm and points at the Matrixdock-RWA/RWA-Contracts repository. It is a SEP-41 Soroban token.',
      'Matrixdock says each token stands for one troy ounce. ReserveWatch has not checked the gold.',
    ],
  },
  {
    id: 'stellar-vnxau',
    ledger: 'stellar',
    name: 'VNX Gold (VNXAU)',
    project: 'VNX',
    displayCode: 'VNXAU',
    gramsPerToken: 1,
    address: 'VNXAU',
    issuer: 'GCKIYYQVIFBIFDRN7BNDNHL3UZSFHT5NHDAISG2N3MWCZY3WNXL3LXN3',
    kind: 'classic',
    bridged: false,
    website: 'https://vnx.li/',
    sourceUrl: 'https://vnx.gitbook.io/vnx-platform/vnx-gold/token-details',
    explorerUrl: 'https://stellar.expert/explorer/public/asset/VNXAU-GCKIYYQVIFBIFDRN7BNDNHL3UZSFHT5NHDAISG2N3MWCZY3WNXL3LXN3',
    notes: [
      'VNX lists this classic Stellar asset as VNX Gold. VNX says one token is one gram of gold.',
      'ReserveWatch has not checked the gold.',
    ],
  },
];

export const chainTokenById = (id: string) => CHAIN_TOKENS.find(t => t.id === id);
