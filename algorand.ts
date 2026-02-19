/**
 * AlgoDAO — Algorand Client Utilities
 * ABI calls, algod/indexer, contract interaction
 */
import algosdk from 'algosdk'

// ── Config ────────────────────────────────────────────────────────────────────
export const ALGOD_SERVER = import.meta.env.VITE_ALGOD_SERVER || 'https://testnet-api.algonode.cloud'
export const INDEXER_SERVER = import.meta.env.VITE_INDEXER_SERVER || 'https://testnet-idx.algonode.cloud'
export const APP_ID = parseInt(import.meta.env.VITE_APP_ID || '1234567890')
export const GOVERNANCE_TOKEN_ID = parseInt(import.meta.env.VITE_GOVERNANCE_TOKEN_ID || '0')
export const NETWORK = import.meta.env.VITE_NETWORK || 'testnet'

export const algodClient = new algosdk.Algodv2('', ALGOD_SERVER, 443)
export const indexerClient = new algosdk.Indexer('', INDEXER_SERVER, 443)

// ── ABI Contract ──────────────────────────────────────────────────────────────
export const DAO_ABI = {
  name: 'AlgoDAO',
  methods: [
    {
      name: 'create_proposal',
      args: [
        { name: 'title', type: 'string' },
        { name: 'description', type: 'string' },
        { name: 'category', type: 'string' },
        { name: 'execution_data', type: 'string' },
        { name: 'custom_voting_period', type: 'uint64' },
        { name: 'custom_quorum', type: 'uint64' },
      ],
      returns: { type: 'uint64' },
    },
    {
      name: 'cast_vote',
      args: [
        { name: 'proposal_id', type: 'uint64' },
        { name: 'vote_choice', type: 'string' },
      ],
      returns: { type: 'uint64' },
    },
    {
      name: 'execute_proposal',
      args: [{ name: 'proposal_id', type: 'uint64' }],
      returns: { type: 'string' },
    },
    {
      name: 'get_dao_info',
      args: [],
      returns: { type: '(string,string,uint64,uint64,uint64)' },
    },
    {
      name: 'get_voting_config',
      args: [],
      returns: { type: '(uint64,uint64,uint64,uint64)' },
    },
    {
      name: 'check_voter_eligibility',
      args: [{ name: 'voter', type: 'address' }],
      returns: { type: 'uint64' },
    },
  ],
}

// ── Types ─────────────────────────────────────────────────────────────────────
export interface Proposal {
  id: number
  title: string
  description: string
  category: 'TREASURY' | 'PROTOCOL' | 'MEMBERSHIP' | 'GENERAL'
  proposer: string
  status: 'ACTIVE' | 'PASSED' | 'REJECTED' | 'EXECUTED' | 'PENDING' | 'CANCELLED'
  votesFor: number
  votesAgainst: number
  votesAbstain: number
  totalVoters: number
  votingStart: number
  votingEnd: number
  executionData: string
  quorumThreshold: number
  txId?: string
}

export interface DAOInfo {
  name: string
  description: string
  totalProposals: number
  totalVotes: number
  treasury: number
}

export interface VotingConfig {
  tokenId: number
  minTokensToPropose: number
  votingPeriod: number
  quorumPct: number
}

// ── Contract Calls ────────────────────────────────────────────────────────────

export async function createProposal(
  sender: string,
  signer: algosdk.TransactionSigner,
  params: {
    title: string
    description: string
    category: string
    executionData: string
    customPeriod?: number
    customQuorum?: number
  }
): Promise<{ proposalId: number; txId: string }> {
  const sp = await algodClient.getTransactionParams().do()
  const contract = new algosdk.ABIContract(DAO_ABI as algosdk.ABIContractParams)
  const method = contract.getMethodByName('create_proposal')
  const atc = new algosdk.AtomicTransactionComposer()

  atc.addMethodCall({
    appID: APP_ID,
    method,
    methodArgs: [
      params.title,
      params.description,
      params.category,
      params.executionData,
      params.customPeriod || 0,
      params.customQuorum || 0,
    ],
    sender,
    suggestedParams: sp,
    signer,
  })

  const result = await atc.execute(algodClient, 4)
  return {
    proposalId: Number(result.methodResults[0].returnValue),
    txId: result.txIDs[0],
  }
}

export async function castVote(
  sender: string,
  signer: algosdk.TransactionSigner,
  proposalId: number,
  choice: 'FOR' | 'AGAINST' | 'ABSTAIN'
): Promise<{ weight: number; txId: string }> {
  const sp = await algodClient.getTransactionParams().do()
  const contract = new algosdk.ABIContract(DAO_ABI as algosdk.ABIContractParams)
  const method = contract.getMethodByName('cast_vote')
  const atc = new algosdk.AtomicTransactionComposer()

  atc.addMethodCall({
    appID: APP_ID,
    method,
    methodArgs: [proposalId, choice],
    sender,
    suggestedParams: sp,
    signer,
  })

  const result = await atc.execute(algodClient, 4)
  return {
    weight: Number(result.methodResults[0].returnValue),
    txId: result.txIDs[0],
  }
}

export async function getDAOInfo(): Promise<DAOInfo> {
  try {
    const appInfo = await algodClient.getApplicationByID(APP_ID).do()
    const gs = appInfo.params['global-state'] as Array<{ key: string; value: { uint?: number; bytes?: string; type: number } }>
    const state: Record<string, any> = {}
    for (const kv of gs) {
      const key = atob(kv.key)
      state[key] = kv.value.type === 1 ? atob(kv.value.bytes || '') : kv.value.uint
    }
    return {
      name: state['dn'] || 'AlgoDAO',
      description: state['dd'] || '',
      totalProposals: state['tp'] || 0,
      totalVotes: state['tv'] || 0,
      treasury: state['tb'] || 0,
    }
  } catch {
    return { name: 'AlgoDAO', description: '', totalProposals: 0, totalVotes: 0, treasury: 0 }
  }
}

export async function getVoterPower(address: string): Promise<number> {
  try {
    const info = await algodClient.accountAssetInformation(address, GOVERNANCE_TOKEN_ID).do()
    return info['asset-holding']?.amount || 0
  } catch {
    return 0
  }
}

export function explorerTxUrl(txId: string) {
  return `https://testnet.explorer.perawallet.app/tx/${txId}`
}

export function explorerAppUrl() {
  return `https://testnet.explorer.perawallet.app/application/${APP_ID}`
}

export function shortenAddr(addr: string) {
  if (!addr) return ''
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export function formatAlgo(microAlgos: number) {
  return `${(microAlgos / 1_000_000).toFixed(3)} ALGO`
}

export function timeLeft(endTimestamp: number): string {
  const diff = endTimestamp - Date.now()
  if (diff <= 0) return 'Ended'
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  const mins = Math.floor((diff % 3600000) / 60000)
  if (days > 0) return `${days}d ${hours}h left`
  if (hours > 0) return `${hours}h ${mins}m left`
  return `${mins}m left`
}
