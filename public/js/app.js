// ═══════════════════════════════════════
//  DocChain — app.js
//  FIX: re-bind signer before every action
//  so first attempt always works
// ═══════════════════════════════════════

let provider, signer, contract;
let myAddr = '', contractAddr = '', ganacheAccts = [];
const ZERO = '0x0000000000000000000000000000000000000000';

// ── Navigation ──────────────────────────
function go(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('pg-' + page).classList.add('active');
  const n = document.getElementById('nav-' + page);
  if (n) n.classList.add('active');
}

// ════════════════════════════════════════
//  KEY FIX: refreshSigner()
//  Call this at the start of EVERY action.
//  Re-reads the current MetaMask account
//  and rebuilds the contract with fresh signer.
//  This is why first attempt was failing —
//  signer was stale after page load.
// ════════════════════════════════════════
async function refreshSigner() {
  if (!window.ethereum) throw new Error('MetaMask not found');
  if (!contractAddr)    throw new Error('Contract not connected — set address on Dashboard');

  provider = new ethers.BrowserProvider(window.ethereum);
  signer   = await provider.getSigner();
  myAddr   = await signer.getAddress();
  contract = new ethers.Contract(contractAddr, ABI, signer);

  // Update UI
  setChip(myAddr);
}

// ── Connect MetaMask ────────────────────
async function connectWallet() {
  if (!window.ethereum) { toast('Install MetaMask in Edge first', 'err'); return; }
  try {
    provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send('eth_requestAccounts', []);
    signer  = await provider.getSigner();
    myAddr  = await signer.getAddress();

    const net = await provider.getNetwork();
    const cid = Number(net.chainId);
    const ok  = cid === 1337;

    document.getElementById('netBadge').textContent = ok
      ? '🟢 Ganache 1337' : `⚠ Chain ${cid} — need 1337`;
    document.getElementById('netBadge').style.color = ok ? 'var(--green)' : 'var(--red)';

    if (!ok) {
      showBanner(`MetaMask is on Chain ${cid}. Switch to Ganache CLI:<br>
        RPC: <b>http://127.0.0.1:8545</b> · Chain ID: <b>1337</b>`, 'err');
    }

    document.getElementById('connectBtn').textContent = '✓ Connected';
    document.getElementById('connectBtn').style.cssText = 'border-color:var(--green);color:var(--green)';
    document.getElementById('walletBadge').style.display = 'flex';
    setChip(myAddr);

    if (contractAddr) {
      contract = new ethers.Contract(contractAddr, ABI, signer);
      await refreshCount();
    }

    window.ethereum.on('accountsChanged', async accs => {
      if (!accs.length) return;
      myAddr  = accs[0];
      signer  = await provider.getSigner();
      setChip(myAddr);
      if (contractAddr) {
        contract = new ethers.Contract(contractAddr, ABI, signer);
        await refreshCount();
      }
      markActive(myAddr);
      toast('Account: ' + sh(myAddr), 'info');
    });

    window.ethereum.on('chainChanged', () => location.reload());

    await loadAccts();
    toast('Connected: ' + sh(myAddr), 'ok');
  } catch(e) { toast(e.message, 'err'); }
}

// ── Set contract ────────────────────────
async function setContract() {
  const addr = document.getElementById('contractInput').value.trim();
  if (!addr.startsWith('0x') || addr.length !== 42) {
    toast('Paste valid 0x address from Remix', 'err'); return;
  }
  if (!signer) { toast('Connect MetaMask first', 'err'); return; }

  const net = await provider.getNetwork();
  if (Number(net.chainId) !== 1337) {
    showBanner('Switch MetaMask to Ganache (Chain 1337) first', 'err'); return;
  }

  contractAddr = addr;
  contract = new ethers.Contract(contractAddr, ABI, signer);
  document.getElementById('statContract').textContent = sh(addr);

  try {
    await refreshCount();
    clearBanner();
    toast('Contract connected! All actions will now work on first click.', 'ok');
    await loadAccts();
  } catch(e) {
    contract = null; contractAddr = '';
    showBanner(`Cannot read contract.<br>
      In Remix → <b>Environment → Dev-Ganache Provider → RPC: http://127.0.0.1:8545</b>
      → Deploy → copy address → paste above`, 'err');
    toast('Cannot read contract — see banner', 'err');
  }
}

async function refreshCount() {
  if (!contract) return;
  try {
    const n = await contract.docCount();
    document.getElementById('statDocs').textContent = n.toString();
  } catch(e) {}
}

// ════════════════════════════════════════
//  UPLOAD DOCUMENT
//  FIX: calls refreshSigner() first
// ════════════════════════════════════════
async function uploadDocument() {
  try {
    await refreshSigner();  // ← THIS fixes the first-click issue
  } catch(e) { toast(e.message, 'err'); return; }

  const title  = document.getElementById('upTitle').value.trim();
  const note   = document.getElementById('upNote').value.trim();
  const fileEl = document.getElementById('upFile');

  if (!title)           { toast('Title required', 'err'); return; }
  if (!fileEl.files[0]) { toast('Select a file', 'err'); return; }

  const file = fileEl.files[0];
  spin('spinUp', true);
  res('upRes', '⏳ Step 1/2 — Saving file to local server…', 'info');

  try {
    const nextId = Number(await contract.docCount()) + 1;

    const fd = new FormData();
    fd.append('file',  file);
    fd.append('docId', String(nextId));
    const r = await fetch('/api/upload', { method:'POST', body: fd });
    const d = await r.json();
    if (!d.success) throw new Error(d.error);

    res('upRes', '⏳ Step 2/2 — Writing to blockchain… confirm MetaMask popup', 'info');

    const tx = await contract.uploadDoc(title, d.sha256, d.size, d.ext, d.filename, note || '');
    await tx.wait();

    localStorage.setItem('fn_' + nextId, d.filename);
    localStorage.setItem('on_' + nextId, d.originalName);
    await refreshCount();

    res('upRes',
      `✓ Doc <b>#${nextId}</b> uploaded!<br>
       📁 ${d.originalName} (${d.size})<br>
       🔒 SHA256: <span class="mono">${d.sha256.slice(0,32)}…</span><br>
       ⛓ TX: <span class="mono">${sh(tx.hash)}</span>`, 'ok');
    toast('Doc #' + nextId + ' uploaded!', 'ok');
    document.getElementById('upTitle').value = '';
    document.getElementById('upNote').value  = '';
    fileEl.value = '';
  } catch(e) {
    res('upRes', '✕ ' + err(e) + '<br><small style="color:var(--muted)">If MetaMask popup did not appear, click Upload again.</small>', 'err');
    toast(err(e), 'err');
  }
  spin('spinUp', false);
}

// ════════════════════════════════════════
//  FORWARD
//  FIX: calls refreshSigner() first
// ════════════════════════════════════════
async function forwardDoc() {
  try { await refreshSigner(); } catch(e) { toast(e.message, 'err'); return; }

  const id   = parseInt(document.getElementById('fwdId').value);
  const to   = document.getElementById('fwdTo').value.trim();
  const note = document.getElementById('fwdNote').value.trim();
  if (!id || !to) { toast('Enter Doc ID and recipient address', 'err'); return; }
  if (!to.startsWith('0x') || to.length !== 42) { toast('Invalid wallet address', 'err'); return; }

  spin('spinFwd', true);
  try {
    const tx = await contract.forwardDoc(id, to, note || '');
    toast('Forwarding… confirm MetaMask', 'info');
    await tx.wait();
    res('fwdRes', `✓ Doc #${id} forwarded to ${sh(to)}<br>TX: <span class="mono">${sh(tx.hash)}</span>`, 'ok');
    toast('Forwarded!', 'ok');
  } catch(e) { res('fwdRes', '✕ ' + err(e), 'err'); toast(err(e), 'err'); }
  spin('spinFwd', false);
}

// ════════════════════════════════════════
//  APPROVE
//  FIX: calls refreshSigner() first
// ════════════════════════════════════════
async function approveDoc() {
  try { await refreshSigner(); } catch(e) { toast(e.message, 'err'); return; }

  const id   = parseInt(document.getElementById('arId').value);
  const note = document.getElementById('arNote').value.trim();
  if (!id) { toast('Enter document ID', 'err'); return; }

  spin('spinAR', true);
  try {
    const tx = await contract.approveDoc(id, note || 'Approved');
    toast('Approving… confirm MetaMask', 'info');
    await tx.wait();
    res('arRes', `✓ Doc #${id} APPROVED | TX: <span class="mono">${sh(tx.hash)}</span>`, 'ok');
    toast('Approved!', 'ok');
  } catch(e) { res('arRes', '✕ ' + err(e), 'err'); toast(err(e), 'err'); }
  spin('spinAR', false);
}

// ════════════════════════════════════════
//  REJECT
//  FIX: calls refreshSigner() first
// ════════════════════════════════════════
async function rejectDoc() {
  try { await refreshSigner(); } catch(e) { toast(e.message, 'err'); return; }

  const id   = parseInt(document.getElementById('arId').value);
  const note = document.getElementById('arNote').value.trim();
  if (!id)   { toast('Enter document ID', 'err'); return; }
  if (!note) { toast('Rejection reason is required', 'err'); return; }

  spin('spinAR', true);
  try {
    const tx = await contract.rejectDoc(id, note);
    toast('Rejecting… confirm MetaMask', 'info');
    await tx.wait();
    res('arRes', `✕ Doc #${id} REJECTED | TX: <span class="mono">${sh(tx.hash)}</span>`, 'err');
    toast('Rejected', 'ok');
  } catch(e) { res('arRes', '✕ ' + err(e), 'err'); toast(err(e), 'err'); }
  spin('spinAR', false);
}

// ════════════════════════════════════════
//  VERIFY (mark as Verified on chain)
//  FIX: calls refreshSigner() first
// ════════════════════════════════════════
async function verifyOnChain() {
  try { await refreshSigner(); } catch(e) { toast(e.message, 'err'); return; }

  const id   = parseInt(document.getElementById('verifyId').value);
  const note = document.getElementById('verifyNote').value.trim();
  if (!id) { toast('Enter document ID', 'err'); return; }

  spin('spinVerify', true);
  try {
    const tx = await contract.verifyDoc(id, note || 'Verified');
    toast('Verifying… confirm MetaMask', 'info');
    await tx.wait();
    res('verifyRes', `◎ Doc #${id} marked VERIFIED | TX: <span class="mono">${sh(tx.hash)}</span>`, 'ok');
    toast('Verified!', 'ok');
  } catch(e) { res('verifyRes', '✕ ' + err(e), 'err'); toast(err(e), 'err'); }
  spin('spinVerify', false);
}

// ════════════════════════════════════════
//  TAMPER DETECTION
//  Server computes hash → compare with stored
//  Also calls checkIntegrity on blockchain
// ════════════════════════════════════════
async function checkTamper() {
  // tamper check is read-only on chain, but we still refresh
  try { await refreshSigner(); } catch(e) { toast(e.message, 'err'); return; }

  const id   = parseInt(document.getElementById('tamId').value);
  const fEl  = document.getElementById('tamFile');
  if (!id)           { toast('Enter document ID', 'err'); return; }
  if (!fEl.files[0]) { toast('Select a file to verify', 'err'); return; }

  spin('spinTam', true);
  const box = document.getElementById('tamBox');
  box.style.display = 'block';
  box.className = 'tamper-box';
  box.innerHTML = '<div class="t-loading">⏳ Computing SHA256 hash and comparing…</div>';

  try {
    const fd = new FormData();
    fd.append('file',  fEl.files[0]);
    fd.append('docId', String(id));
    const r = await fetch('/api/verify', { method:'POST', body: fd });
    const d = await r.json();
    if (d.error) throw new Error(d.error);

    // Also check on blockchain (free read, no gas)
    let chainLine = '';
    try {
      const [ok, msg] = await contract.checkIntegrity(id, d.uploadedHash);
      chainLine = `<div class="chain-note ${ok?'c-ok':'c-fail'}">
        ⛓ Blockchain confirms: <b>${msg}</b></div>`;
    } catch(e) {}

    if (d.authentic) {
      box.className = 'tamper-box t-ok';
      box.innerHTML = `
        <div class="t-icon">✓</div>
        <div class="t-title">DOCUMENT AUTHENTIC</div>
        <div class="t-sub">Hash matches — file is original and unmodified</div>
        <div class="t-hashes">
          <div><span>Original Hash (stored at upload)</span><code>${d.storedHash}</code></div>
          <div><span>Current Hash (just computed)</span><code>${d.uploadedHash}</code></div>
        </div>${chainLine}`;
      toast('AUTHENTIC ✓', 'ok');
    } else {
      box.className = 'tamper-box t-fail';
      box.innerHTML = `
        <div class="t-icon">✕</div>
        <div class="t-title">DOCUMENT TAMPERED!</div>
        <div class="t-sub">Hash mismatch — file was modified after upload</div>
        <div class="t-hashes">
          <div><span>Original Hash (stored at upload)</span><code>${d.storedHash}</code></div>
          <div><span>Current Hash (just computed)</span><code style="color:var(--red)">${d.uploadedHash}</code></div>
        </div>${chainLine}`;
      toast('TAMPERED — Hash mismatch!', 'err');
    }
  } catch(e) {
    box.className = 'tamper-box t-fail';
    box.innerHTML = `<div class="t-title">Error</div><div class="t-sub">${err(e)}</div>`;
    toast(err(e), 'err');
  }
  spin('spinTam', false);
}

// ════════════════════════════════════════
//  ALL DOCUMENTS
// ════════════════════════════════════════
async function loadDocs() {
  try { await refreshSigner(); } catch(e) { toast(e.message, 'err'); return; }

  const wrap = document.getElementById('docsWrap');
  wrap.innerHTML = '<div class="empty">Loading…</div>';
  try {
    const total = Number(await contract.docCount());
    document.getElementById('statDocs').textContent = total;
    if (!total) { wrap.innerHTML = '<div class="empty">No documents yet. Upload one!</div>'; return; }

    let html = '';
    for (let i = 1; i <= total; i++) {
      try {
        const d  = await fetchDoc(i);
        const s  = SC[d.status] || SC['Uploaded'];
        const me = d.uploader.toLowerCase() === myAddr.toLowerCase();
        const mh = d.holder.toLowerCase()   === myAddr.toLowerCase();
        const fn = localStorage.getItem('fn_' + i) || '';
        html += `
          <div class="doc-card">
            <div class="doc-top">
              <span class="doc-id">DOC #${i}</span>
              <span class="status-pill" style="color:${s.c};border-color:${s.b};background:${s.bg}">${d.status}</span>
            </div>
            <div class="doc-title">${d.title}</div>
            <div class="doc-row">
              <span>📁 ${d.fileType.toUpperCase()} · ${d.fileSize}</span>
              <span>${fmtDate(d.createdAt)}</span>
            </div>
            <div class="doc-row" style="margin-top:4px">
              <span title="${d.uploader}">Uploader: ${sh(d.uploader)}${me?' <span class="you">YOU</span>':''}</span>
              <span title="${d.holder}">Holder: ${sh(d.holder)}${mh?' <span class="you">YOU</span>':''}</span>
            </div>
            <div class="doc-hash">Hash: <code>${d.hash.slice(0,22)}…</code></div>
            <div class="doc-btns">
              ${fn?`<button class="btn btn-xs" onclick="window.open('/api/file/${fn}','_blank')">👁 View</button>`:''}
              <button class="btn btn-xs" onclick="jumpAudit(${i})">≡ Audit</button>
              <button class="btn btn-xs" onclick="jumpTamper(${i})">◎ Verify</button>
              <button class="btn btn-xs" onclick="jumpFwd(${i})">→ Forward</button>
            </div>
          </div>`;
      } catch(e) {}
    }
    wrap.innerHTML = `<div class="docs-grid">${html}</div>`;
  } catch(e) {
    wrap.innerHTML = '<div class="empty">Error — connect wallet and contract first</div>';
  }
}

function jumpAudit(id)  { document.getElementById('auditId').value = id; go('audit'); loadAudit(); }
function jumpTamper(id) { document.getElementById('tamId').value   = id; go('tamper'); }
function jumpFwd(id)    { document.getElementById('fwdId').value   = id; go('forward'); }

// ════════════════════════════════════════
//  AUDIT TRAIL
// ════════════════════════════════════════
async function loadAudit() {
  try { await refreshSigner(); } catch(e) { toast(e.message, 'err'); return; }

  const id   = parseInt(document.getElementById('auditId').value);
  if (!id) { toast('Enter document ID', 'err'); return; }

  const wrap = document.getElementById('auditWrap');
  wrap.innerHTML = '<div class="empty">Loading…</div>';
  document.getElementById('auditCard').style.display = 'block';

  try {
    const d   = await fetchDoc(id);
    const len = Number(await contract.logCount(id));
    const s   = SC[d.status] || SC['Uploaded'];

    let html = `
      <div class="audit-hdr">
        <div class="audit-title">Doc #${id} — ${d.title}</div>
        <div class="audit-meta">${len} entries · Status: <span style="color:${s.c}">${d.status}</span></div>
      </div>
      <div class="audit-line">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</div>`;

    for (let i = 0; i < len; i++) {
      const [action, by, to, note, ts] = await contract.getLog(id, i);
      const color = AC[action] || '#dce8f5';
      const hasTo = to && to !== ZERO;
      html += `
        <div class="audit-row">
          <div class="audit-n">${i+1}</div>
          <div class="audit-body">
            <div class="audit-action" style="color:${color}">${action}</div>
            <div class="audit-by">
              <span class="al">by</span> <span class="aa" title="${by}">${sh(by)}</span>
              ${hasTo?`<span class="al">→</span> <span class="aa" title="${to}">${sh(to)}</span>`:''}
            </div>
            ${note?`<div class="audit-note">"${note}"</div>`:''}
          </div>
          <div class="audit-ts">${fmtDT(Number(ts))}</div>
        </div>`;
    }

    html += `
      <div class="audit-line">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</div>
      <div class="audit-footer">All entries are permanent. Nobody can add, delete, or edit any line.</div>`;

    wrap.innerHTML = html;
  } catch(e) { wrap.innerHTML = `<div class="empty">Error: ${err(e)}</div>`; }
}

// ════════════════════════════════════════
//  ACCOUNT SWITCHER
// ════════════════════════════════════════
async function loadAccts() {
  try {
    if (!provider) return;
    ganacheAccts = await provider.send('eth_accounts', []);
    const wrap   = document.getElementById('accList');
    wrap.innerHTML = '';
    for (let i = 0; i < ganacheAccts.length; i++) {
      const addr   = ganacheAccts[i];
      const active = addr.toLowerCase() === myAddr.toLowerCase();
      const row    = document.createElement('div');
      row.className = 'acc-row' + (active ? ' acc-active' : '');
      row.id = 'acc-' + addr.toLowerCase();
      row.innerHTML = `
        <div class="acc-i">#${i}</div>
        <div class="acc-s">${sh(addr)}</div>
        <div class="acc-f">${addr}</div>
        <button class="btn btn-xs" onclick="copyTxt('${addr}')">Copy</button>`;
      wrap.appendChild(row);
    }
    document.getElementById('switchCard').style.display = 'block';
  } catch(e) {}
}

function markActive(addr) {
  document.querySelectorAll('.acc-row').forEach(r => r.classList.remove('acc-active'));
  const el = document.getElementById('acc-' + addr.toLowerCase());
  if (el) el.classList.add('acc-active');
}

// ════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════
async function fetchDoc(id) {
  const r = await contract.getDoc(id);
  return {
    id:Number(r[0]), title:r[1], hash:r[2], fileSize:r[3], fileType:r[4],
    fileName:r[5], uploader:r[6], holder:r[7], status:r[8],
    createdAt:Number(r[9]), updatedAt:Number(r[10])
  };
}

function sh(addr) {
  if (!addr || addr.length < 10) return addr;
  return addr.slice(0,6) + '…' + addr.slice(-4);
}

function setChip(addr) {
  const c = document.getElementById('addrChip');
  if (c) { c.textContent = sh(addr); c.title = addr; }
  const s = document.getElementById('statAddr');
  if (s) s.textContent = addr;
}

function fmtDate(ts) {
  return new Date(ts*1000).toLocaleDateString('en-IN',
    { day:'2-digit', month:'short', year:'numeric' });
}
function fmtDT(ts) {
  return new Date(ts*1000).toLocaleString('en-IN',
    { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

function spin(id, on) {
  const e = document.getElementById(id);
  if (e) e.style.display = on ? 'inline-block' : 'none';
}

function res(id, html, type) {
  const e = document.getElementById(id);
  if (!e) return;
  const c = { ok:'var(--green)', err:'var(--red)', info:'var(--accent)' };
  e.style.display = 'block';
  e.innerHTML = `<span style="color:${c[type]};line-height:1.9;font-family:var(--mono);font-size:.78rem">${html}</span>`;
}

function err(e) {
  if (e.reason) return e.reason;
  if (e.message) {
    const m = e.message.match(/execution reverted: "?([^"(]+)"?/);
    if (m) return m[1].trim();
    if (e.message.includes('user rejected'))  return 'Cancelled by user in MetaMask';
    if (e.message.includes('missing revert')) return 'Contract call failed — is Ganache running on port 8545?';
    if (e.message.includes('could not decode')) return 'Contract mismatch — redeploy contract and reconnect';
    return e.message.slice(0, 160);
  }
  return 'Transaction failed';
}

function showBanner(html, type) {
  let el = document.getElementById('banner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'banner';
    document.getElementById('pg-dashboard').appendChild(el);
  }
  const st = type === 'err'
    ? 'background:rgba(239,68,68,.07);border:1px solid rgba(239,68,68,.35);color:var(--text)'
    : 'background:rgba(0,229,255,.05);border:1px solid rgba(0,229,255,.2);color:var(--text)';
  el.style.cssText = `margin-top:1rem;padding:1rem 1.2rem;border-radius:4px;font-size:.8rem;line-height:2;${st}`;
  el.innerHTML = html;
  el.style.display = 'block';
}

function clearBanner() {
  const el = document.getElementById('banner');
  if (el) el.style.display = 'none';
}

function copyTxt(t) {
  navigator.clipboard.writeText(t);
  toast('Copied: ' + sh(t), 'ok');
}

function toast(msg, type = 'info') {
  const el   = document.getElementById('toast');
  const icon = { ok:'✓', err:'✕', info:'◈' };
  el.className = 'toast-' + type;
  document.getElementById('toastIcon').textContent = icon[type] || '◈';
  document.getElementById('toastMsg').textContent  = msg;
  el.classList.add('show');
  clearTimeout(window._tt);
  window._tt = setTimeout(() => el.classList.remove('show'), 5000);
}
