// DocChain ABI — matches DocChain.sol exactly
const ABI = [
  "function docCount() view returns(uint256)",
  "function uploadDoc(string _title, string _hash, string _size, string _type, string _fileName, string _note) public returns(uint256)",
  "function forwardDoc(uint256 _id, address _to, string _note) public",
  "function approveDoc(uint256 _id, string _note) public",
  "function rejectDoc(uint256 _id, string _note) public",
  "function verifyDoc(uint256 _id, string _note) public",
  "function checkIntegrity(uint256 _id, string _hash) view returns(bool, string)",
  "function getDoc(uint256 _id) view returns(uint256,string,string,string,string,string,address,address,string,uint256,uint256)",
  "function logCount(uint256 _id) view returns(uint256)",
  "function getLog(uint256 _id, uint256 _i) view returns(string,address,address,string,uint256)",
  "event Uploaded(uint256 id, string title, address by)",
  "event Forwarded(uint256 id, address from, address to)",
  "event ActionTaken(uint256 id, string action, address by)"
];

// Status color map
const SC = {
  'Uploaded':  { c:'#94a3b8', b:'#4e5d78', bg:'rgba(78,93,120,.12)'  },
  'Forwarded': { c:'#f59e0b', b:'#f59e0b', bg:'rgba(245,158,11,.1)'  },
  'Approved':  { c:'#10b981', b:'#10b981', bg:'rgba(16,185,129,.1)'  },
  'Rejected':  { c:'#ef4444', b:'#ef4444', bg:'rgba(239,68,68,.1)'   },
  'Verified':  { c:'#00e5ff', b:'#00e5ff', bg:'rgba(0,229,255,.1)'   }
};

const AC = {
  'Uploaded':  '#00e5ff',
  'Forwarded': '#f59e0b',
  'Approved':  '#10b981',
  'Rejected':  '#ef4444',
  'Verified':  '#00e5ff'
};
