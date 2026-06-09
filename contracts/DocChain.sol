// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * DocChain — Open Document Circulation
 * ANYONE can upload, forward, approve, reject, verify.
 * Files stored on local server. Only metadata + hash on chain.
 */
contract DocChain {

    uint256 public docCount;

    struct Document {
        uint256 id;
        string  title;
        string  hash;       // SHA256 of file — tamper detection
        string  fileSize;
        string  fileType;
        string  fileName;   // stored on server as this name
        address uploader;
        address holder;     // who currently has it
        string  status;     // Uploaded / Forwarded / Approved / Rejected / Verified
        uint256 createdAt;
        uint256 updatedAt;
    }

    struct Log {
        string  action;
        address by;
        address to;
        string  note;
        uint256 ts;
    }

    mapping(uint256 => Document) private docs;
    mapping(uint256 => Log[])    private logs;

    event Uploaded(uint256 id, string title, address by);
    event Forwarded(uint256 id, address from, address to);
    event ActionTaken(uint256 id, string action, address by);

    // ── Upload ──────────────────────────────────────
    function uploadDoc(
        string memory _title,
        string memory _hash,
        string memory _size,
        string memory _type,
        string memory _fileName,
        string memory _note
    ) public returns (uint256) {
        require(bytes(_title).length > 0, "Title required");
        require(bytes(_hash).length  > 0, "Hash required");
        docCount++;
        docs[docCount] = Document(
            docCount, _title, _hash, _size, _type, _fileName,
            msg.sender, msg.sender, "Uploaded",
            block.timestamp, block.timestamp
        );
        logs[docCount].push(Log("Uploaded", msg.sender, address(0), _note, block.timestamp));
        emit Uploaded(docCount, _title, msg.sender);
        return docCount;
    }

    // ── Forward ─────────────────────────────────────
    function forwardDoc(uint256 _id, address _to, string memory _note)
        public validDoc(_id)
    {
        require(_to != address(0),  "Invalid address");
        require(_to != msg.sender,  "Cannot forward to yourself");
        docs[_id].holder    = _to;
        docs[_id].status    = "Forwarded";
        docs[_id].updatedAt = block.timestamp;
        logs[_id].push(Log("Forwarded", msg.sender, _to, _note, block.timestamp));
        emit Forwarded(_id, msg.sender, _to);
    }

    // ── Approve ─────────────────────────────────────
    function approveDoc(uint256 _id, string memory _note)
        public validDoc(_id)
    {
        docs[_id].status    = "Approved";
        docs[_id].updatedAt = block.timestamp;
        logs[_id].push(Log("Approved", msg.sender, address(0), _note, block.timestamp));
        emit ActionTaken(_id, "Approved", msg.sender);
    }

    // ── Reject ──────────────────────────────────────
    function rejectDoc(uint256 _id, string memory _note)
        public validDoc(_id)
    {
        require(bytes(_note).length > 0, "Reason required for rejection");
        docs[_id].status    = "Rejected";
        docs[_id].updatedAt = block.timestamp;
        logs[_id].push(Log("Rejected", msg.sender, address(0), _note, block.timestamp));
        emit ActionTaken(_id, "Rejected", msg.sender);
    }

    // ── Verify (mark as finally verified) ───────────
    function verifyDoc(uint256 _id, string memory _note)
        public validDoc(_id)
    {
        docs[_id].status    = "Verified";
        docs[_id].updatedAt = block.timestamp;
        logs[_id].push(Log("Verified", msg.sender, address(0), _note, block.timestamp));
        emit ActionTaken(_id, "Verified", msg.sender);
    }

    // ── Tamper check (free, no gas) ─────────────────
    function checkIntegrity(uint256 _id, string memory _hash)
        public view validDoc(_id)
        returns (bool ok, string memory msg_)
    {
        bool match_ = keccak256(abi.encodePacked(docs[_id].hash))
                   == keccak256(abi.encodePacked(_hash));
        return match_
            ? (true,  "Document Authentic")
            : (false, "Document Tampered");
    }

    // ── Read document ────────────────────────────────
    function getDoc(uint256 _id)
        public view validDoc(_id)
        returns (
            uint256, string memory, string memory, string memory,
            string memory, string memory, address, address,
            string memory, uint256, uint256
        )
    {
        Document memory d = docs[_id];
        return (d.id, d.title, d.hash, d.fileSize, d.fileType,
                d.fileName, d.uploader, d.holder,
                d.status, d.createdAt, d.updatedAt);
    }

    // ── Audit trail ──────────────────────────────────
    function logCount(uint256 _id) public view validDoc(_id) returns (uint256) {
        return logs[_id].length;
    }

    function getLog(uint256 _id, uint256 _i)
        public view validDoc(_id)
        returns (string memory, address, address, string memory, uint256)
    {
        Log memory l = logs[_id][_i];
        return (l.action, l.by, l.to, l.note, l.ts);
    }

    modifier validDoc(uint256 _id) {
        require(_id > 0 && _id <= docCount, "Document not found");
        _;
    }
}
