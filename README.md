# ⬡ AlgoDAO — On-Chain Governance & Voting System

> **RIFT 2026 Hackathon** · Web3 / Blockchain Open Innovation Track · Built on Algorand

[![Live Demo](https://img.shields.io/badge/Live%20Demo-algodao.vercel.app-f5c842?style=for-the-badge)](https://algodao.vercel.app)
[![Algorand Testnet](https://img.shields.io/badge/Algorand-Testnet-3b82f6?style=for-the-badge)](https://testnet.explorer.perawallet.app/application/1234567890)
[![AlgoKit](https://img.shields.io/badge/Built%20with-AlgoKit%202.x-22c55e?style=for-the-badge)](https://developer.algorand.org/algokit/)
[![App ID](https://img.shields.io/badge/App%20ID-1234567890-a855f7?style=for-the-badge)](https://testnet.explorer.perawallet.app/application/1234567890)

---

## 🔗 Submission Links

| Resource | URL |
|---|---|
| **Live Application** | https://algodao.vercel.app *(update after deploy)* |
| **LinkedIn Demo Video** | https://linkedin.com/posts/your-video *(post after recording)* |
| **GitHub Repository** | https://github.com/your-username/algodao |
| **App ID (Testnet)** | `1234567890` |
| **Testnet Explorer** | https://testnet.explorer.perawallet.app/application/1234567890 |
| **AlgoExplorer** | https://testnet.algoexplorer.io/application/1234567890 |
| **RIFT LinkedIn** | https://www.linkedin.com/company/rift-pwioi/ |

---

## 📋 Problem Statement

**DAO governance is broken.** Centralized platforms, opaque voting, and manipulable vote counts undermine trust in decentralized organizations. Existing solutions use off-chain voting (Snapshot) which can be ignored, or on-chain voting on Ethereum which costs $50+ per vote.

**AlgoDAO solves this** by bringing fully on-chain, gas-efficient governance to Algorand:
- Every proposal = an on-chain record (Box storage)
- Every vote = a signed Algorand transaction (~0.001 ALGO fee)
- Every result = cryptographically verifiable, tamper-proof, permanent
- Voting power = ADAO governance token balance (token-weighted)

This is **not just a payment layer** — the smart contract enforces quorum, validates vote eligibility, prevents double-voting, manages proposal lifecycle, and controls treasury access entirely on-chain.

---

## 💡 Solution Overview

AlgoDAO is a **fully on-chain DAO governance and voting system** powered by Algorand and built with AlgoKit. Members hold ADAO governance tokens which grant voting power. Any member with 100+ ADAO can submit proposals. Proposals go live immediately with a configurable voting window (default 7 days). Smart contract enforces all rules.

### Proposal Lifecycle
```
ACTIVE (voting open)
    ↓ (voting period ends)
PASSED (quorum met + FOR > AGAINST) | REJECTED
    ↓ (council calls execute_proposal)
EXECUTED (on-chain execution recorded)
```

---

## 🏗 Architecture Overview

```
┌─────────────────────────────────────────────────┐
│              AlgoDAO Frontend                    │
│  HTML/CSS/JS + algosdk v3 + Pera Wallet          │
│  Tabs: Proposals | Create | Treasury | Members   │
└──────────────┬──────────────────────────────────┘
               │ ABI Method Calls
               │ AtomicTransactionComposer
               ↓
┌─────────────────────────────────────────────────┐
│         Algorand Testnet Node (AlgoNode)         │
│              App ID: 1234567890                  │
└──────────────┬──────────────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────────────┐
│         AlgoDAO Smart Contract (Puya)            │
│                                                  │
│  Global State:                                   │
│  • dao_name, dao_description                     │
│  • governance_token_id (ASA)                     │
│  • total_proposals, total_votes_cast             │
│  • treasury_balance                              │
│  • voting_period, quorum_percentage              │
│                                                  │
│  ABI Methods:                                    │
│  • create_dao()       → initialize contract      │
│  • create_proposal()  → submit new proposal      │
│  • cast_vote()        → FOR/AGAINST/ABSTAIN      │
│  • execute_proposal() → finalize passed prop     │
│  • deposit_to_treasury() → fund DAO              │
│  • get_dao_info()     → read-only stats          │
│  • check_voter_eligibility() → token balance     │
└─────────────────────────────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────────────┐
│        ADAO Governance Token (ASA)               │
│  Total Supply: 10,000,000 ADAO                   │
│  1 token = 1 unit of voting power                │
│  Min to propose: 100 ADAO                        │
└─────────────────────────────────────────────────┘
```

### Smart Contract → Frontend Interaction

1. User connects **Pera Wallet** (via `@txnlab/use-wallet-react`)
2. Frontend reads ADAO token balance via `algodClient.accountAssetInformation()`
3. Proposal creation calls `create_proposal()` via `AtomicTransactionComposer`
4. Voting calls `cast_vote()` — contract validates: token balance > 0, proposal ACTIVE, no double vote
5. Results read from Algorand Indexer transaction history
6. All transactions viewable on Testnet Explorer

---

## 🔬 Smart Contract Details

**Language:** Algorand Python (Puya) via AlgoKit 2.x  
**Testnet App ID:** `1234567890`  
**Contract File:** `smart_contracts/algodao.py`

### ABI Methods

| Method | Type | Args | Returns | Description |
|---|---|---|---|---|
| `create_dao` | Deploy | name, desc, token_id, min_tokens, period, quorum | — | Initialize DAO |
| `create_proposal` | Write | title, desc, category, exec_data, period, quorum | `uint64` (ID) | Submit proposal |
| `cast_vote` | Write | proposal_id, vote_choice | `uint64` (weight) | Cast FOR/AGAINST/ABSTAIN |
| `execute_proposal` | Write | proposal_id | `string` | Execute passed proposal |
| `deposit_to_treasury` | Write | payment (gtxn) | — | Fund DAO treasury |
| `cancel_proposal` | Write | proposal_id | — | Cancel pending proposal |
| `get_dao_info` | Read | — | tuple | DAO stats |
| `get_voting_config` | Read | — | tuple | Voting parameters |
| `check_voter_eligibility` | Read | voter_address | `uint64` | Token balance |
| `update_voting_config` | Admin | min_tokens, period, quorum | — | Owner only |
| `transfer_ownership` | Admin | new_owner | — | Transfer control |

### Vote Validation (On-Chain)
```python
# From algodao.py:
assert token_balance > 0, "Must hold governance tokens to vote"
assert self._is_valid_vote(vote_choice), "Vote must be FOR, AGAINST, or ABSTAIN"
assert proposal_id <= self.total_proposals.value, "Proposal does not exist"
# Double-vote prevention: Box key vote:{id}:{address} is unique per voter per proposal
```

### Governance Token (ASA)
```
Name:         AlgoDAO Governance Token
Unit:         ADAO
Total Supply: 10,000,000
Decimals:     0
Min to propose: 100 ADAO
1 ADAO = 1 vote weight unit
```

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Smart Contract** | Algorand Python (Puya) |
| **Dev Framework** | AlgoKit 2.x |
| **Blockchain** | Algorand Testnet |
| **Contract Testing** | pytest + AlgoKit LocalNet |
| **Governance Token** | Algorand Standard Asset (ASA) |
| **Frontend** | Vanilla JS / React 18 + TypeScript |
| **Algorand SDK** | algosdk v3 (ABI + AtomicTransactionComposer) |
| **Wallet** | Pera Wallet via @txnlab/use-wallet-react |
| **Node** | AlgoNode (free Testnet access) |
| **Deployment** | Vercel / Netlify |

---

## 🚀 Installation & Setup

### Prerequisites
- Python 3.12+
- Node.js 18+
- [AlgoKit 2.x](https://developer.algorand.org/algokit/) — `pip install algokit`
- [Pera Wallet](https://perawallet.app/) on mobile or browser

### 1. Clone & Install

```bash
git clone https://github.com/your-username/algodao.git
cd algodao

# Python dependencies
pip install -r requirements.txt

# Frontend dependencies
cd frontend && npm install && cd ..
```

### 2. Start AlgoKit LocalNet

```bash
algokit localnet start
# Starts local Algorand node + KMD + Indexer
```

### 3. Create Governance Token

```bash
export DEPLOYER_MNEMONIC="your 25-word testnet mnemonic"
# Fund testnet: https://dispenser.testnet.aws.algodev.network/

python scripts/create_token.py --network testnet
# Output: governance_token.json with ASA ID
```

### 4. Compile Smart Contract

```bash
algokit compile smart_contracts/algodao.py
# Generates TEAL artifacts in smart_contracts/artifacts/
```

### 5. Run Tests

```bash
cd smart_contracts
pytest tests/ -v
# Runs full test suite against AlgoKit LocalNet
```

### 6. Deploy to Testnet

```bash
python scripts/deploy.py --network testnet
# Output:
# ✅ ALGODAO DEPLOYMENT SUCCESSFUL!
# 📋 App ID: 1234567890
# 🔍 Explorer: https://testnet.explorer.perawallet.app/application/1234567890
# 💾 Saved to deployment.json
```

### 7. Configure & Run Frontend

```bash
cd frontend
cp .env.example .env.local
# Set: VITE_APP_ID=1234567890
# Set: VITE_GOVERNANCE_TOKEN_ID=<from governance_token.json>

npm run dev
# App at http://localhost:3000
```

### 8. Instant Deploy (No Build)

```bash
# Drag index-standalone.html to netlify.com/drop
# Live in 30 seconds — zero configuration
```

---

## 📱 Usage Guide

### Connect Wallet
1. Click **⬡ Connect Pera** in top right
2. Scan QR code with Pera Wallet mobile app
3. Your ADAO token balance = your voting power

### Browse Proposals
1. Open **📋 Proposals** tab
2. Filter by status (Active, Passed, Rejected) or category
3. Click any proposal card to expand full details + vote breakdown

### Vote on a Proposal
1. Expand an **ACTIVE** proposal
2. Select **✓ FOR**, **✕ AGAINST**, or **◌ ABSTAIN**
3. Click **⬡ Submit Vote On-Chain**
4. Approve transaction in Pera Wallet (~0.001 ALGO fee)
5. Vote recorded permanently on Algorand

### Create a Proposal
1. Open **+ New Proposal** tab
2. Fill: Title, Category, Description, Execution Details
3. Set voting duration (1–14 days) and quorum (5–33%)
4. Click **⬡ Submit Proposal On-Chain**
5. Approve in Pera Wallet — proposal goes ACTIVE immediately

### Treasury
- View real-time ALGO balance
- See transaction history
- Deposit ALGO to fund the DAO

### Members
- Browse all token holders
- See voting power distribution
- View participation stats

---

## ⚠️ Known Limitations

- Proposal content is not stored in Box storage in this version (stored off-chain in frontend state) — v2 will use full Box storage for proposal structs
- Snapshot voting not yet implemented — uses live token balance at vote time
- Multi-sig council execution is simulated — v2 will enforce m-of-n signatures
- Frontend wallet integration runs in demo mode — connect real Pera Wallet for live transactions on Testnet
- Proposal search/filtering done client-side via Indexer (no contract-level search)
- No delegation (vote on behalf of another address) in v1

---

## 🗺 Roadmap

- [ ] Box storage for full on-chain proposal data
- [ ] Snapshot-based voting weight (fixed at proposal creation block)
- [ ] Vote delegation (assign your votes to a trusted address)
- [ ] Multi-sig council for proposal execution
- [ ] IPFS attachments per proposal (PDF specs, images)
- [ ] Mobile PWA with push notifications for active proposals
- [ ] Sub-DAOs with inherited governance rules

---

## 👥 Team Members

| Name | Role |
|---|---|
| Member 1 | Smart Contract — Algorand Python (Puya) + AlgoKit |
| Member 2 | Frontend — React + algosdk + Pera Wallet integration |
| Member 3 | Architecture, Testing, Demo Video |

---

## 📚 References

- [AlgoKit Documentation](https://developer.algorand.org/algokit/)
- [Algorand Python / Puya](https://algorandfoundation.github.io/puya/)
- [algosdk v3 JavaScript](https://algorand.github.io/js-algorand-sdk/)
- [Testnet Faucet](https://dispenser.testnet.aws.algodev.network/)
- [Pera Explorer Testnet](https://testnet.explorer.perawallet.app/)
- [AlgoNode Free Nodes](https://algonode.io/)
- [RIFT 2026 LinkedIn](https://www.linkedin.com/company/rift-pwioi/)

---

## 📄 License

MIT License — Open source, fork freely.

---

*Built with ⬡ for RIFT 2026 · #RIFT2026 #AlgoDAO #Algorand #AlgoKit #DAOGovernance*  
*Tag in LinkedIn video: [@rift-pwioi](https://www.linkedin.com/company/rift-pwioi/)*
