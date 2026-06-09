const express = require('express');
const multer  = require('multer');
const crypto  = require('crypto');
const fs      = require('fs');
const path    = require('path');

const app  = express();
const PORT = 3000;

// Directories
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const HASH_DIR   = path.join(__dirname, 'hashes');
[UPLOAD_DIR, HASH_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d); });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Multer — save file as doc_<id>_<name>
const store = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const id   = req.body.docId || Date.now();
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `doc_${id}_${safe}`);
  }
});
const up     = multer({ storage: store,                     limits: { fileSize: 100e6 } });
const upMem  = multer({ storage: multer.memoryStorage(),    limits: { fileSize: 100e6 } });

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}
function fmtSize(b) {
  if (b < 1024)     return b + ' B';
  if (b < 1048576)  return (b/1024).toFixed(1) + ' KB';
  return (b/1048576).toFixed(2) + ' MB';
}

// ── POST /api/upload ─────────────────────────────
// Save file, compute SHA256, store hash record
app.post('/api/upload', up.single('file'), (req, res) => {
  try {
    if (!req.file)       return res.status(400).json({ error: 'No file' });
    if (!req.body.docId) return res.status(400).json({ error: 'docId required' });

    const buf  = fs.readFileSync(req.file.path);
    const hash = sha256(buf);
    const ext  = path.extname(req.file.originalname).replace('.','').toLowerCase() || 'file';
    const size = fmtSize(req.file.size);

    fs.writeFileSync(
      path.join(HASH_DIR, `${req.body.docId}.json`),
      JSON.stringify({
        docId: req.body.docId,
        sha256: hash,
        filename: req.file.filename,
        originalName: req.file.originalname,
        size, ext,
        savedAt: new Date().toISOString()
      }, null, 2)
    );

    console.log(`[UPLOAD] Doc#${req.body.docId} | ${req.file.originalname} | ${hash.slice(0,16)}...`);
    res.json({ success: true, sha256: hash, filename: req.file.filename,
               originalName: req.file.originalname, size, ext });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/verify ─────────────────────────────
// Re-compute hash of uploaded file, compare with stored
app.post('/api/verify', upMem.single('file'), (req, res) => {
  try {
    if (!req.file)       return res.status(400).json({ error: 'No file' });
    if (!req.body.docId) return res.status(400).json({ error: 'docId required' });

    const hf = path.join(HASH_DIR, `${req.body.docId}.json`);
    if (!fs.existsSync(hf))
      return res.status(404).json({ error: `No hash for Doc #${req.body.docId}. Upload it first.` });

    const stored = JSON.parse(fs.readFileSync(hf));
    const nowHash = sha256(req.file.buffer);
    const ok = stored.sha256 === nowHash;

    console.log(`[VERIFY] Doc#${req.body.docId} | ${ok ? 'AUTHENTIC' : 'TAMPERED'}`);
    res.json({ success: true, authentic: ok,
               storedHash: stored.sha256, uploadedHash: nowHash,
               message: ok ? 'Document Authentic' : 'Document Tampered' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/file/:name ──────────────────────────
app.get('/api/file/:name', (req, res) => {
  const fp = path.join(UPLOAD_DIR, req.params.name);
  if (!fs.existsSync(fp)) return res.status(404).json({ error: 'File not found' });
  res.sendFile(fp);
});

// ── GET /api/hash/:id ────────────────────────────
app.get('/api/hash/:id', (req, res) => {
  const fp = path.join(HASH_DIR, `${req.params.id}.json`);
  if (!fs.existsSync(fp)) return res.status(404).json({ error: 'Hash not found' });
  res.json({ success: true, ...JSON.parse(fs.readFileSync(fp)) });
});

// SPA fallback
app.get('/{*splat}', (_, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => {
  console.log(`
        Blockchain       
  http://localhost:${PORT}                   
`);
});
