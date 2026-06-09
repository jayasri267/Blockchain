# DocChain — NIC Bhubaneswar
## Blockchain Document Circulation System
### Anyone can upload, forward, approve, reject, verify

---

## YOUR SETUP
- MetaMask on Edge browser
- Ganache CLI → port 8545, Chain ID 1337
- Remix IDE
- Node.js

---

## RUN IN 3 COMMANDS

```bash
# Terminal 1 — Start Ganache CLI
ganache --port 8545 --chainId 1337

# Terminal 2 — Start Node server
cd docchain-open
npm install
npm start

# Open browser
http://localhost:3000
```

---

## DEPLOY CONTRACT ON REMIX

1. Open https://remix.ethereum.org
2. New file → paste `contracts/DocChain.sol`
3. Compile tab → Compile DocChain.sol
4. Deploy tab:
   - Environment → **Dev - Ganache Provider**
   - RPC URL → `http://127.0.0.1:8545`
   - Click Deploy
5. Copy address from **Deployed Contracts** section
6. Open http://localhost:3000 → paste address → Connect

---

## METAMASK SETUP (Edge)

Network Name : Ganache CLI
RPC URL      : http://127.0.0.1:8545
Chain ID     : 1337
Currency     : ETH

Import Ganache accounts using private keys shown in Ganache CLI output.

---

## FULL DEMO FLOW

1. Account #0 → Upload document
2. Account #0 → Forward to Account #1
3. Account #1 (switch in MetaMask) → Approve / Reject
4. Account #1 → Forward to Account #2
5. Account #2 (switch) → Approve / Reject
6. Anyone → Mark as Verified
7. Anyone → Tamper Detection → upload original = AUTHENTIC
8. Edit file, save, upload again → TAMPERED
9. Audit Trail → see complete immutable history

---

## FILES

```
docchain-open/
├── contracts/DocChain.sol   ← Deploy this on Remix
├── server.js                ← Node.js backend
├── package.json
├── uploads/                 ← Files stored here (auto-created)
├── hashes/                  ← SHA256 hashes stored here (auto-created)
└── public/
    ├── index.html
    ├── css/style.css
    └── js/
        ├── contract.js      ← ABI
        └── app.js           ← All logic
```
