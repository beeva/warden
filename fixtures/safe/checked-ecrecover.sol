// The fixed counterpart to fixtures/vulnerable/unchecked-ecrecover.sol:
// a real check against address(0) before trusting the recovered signer,
// plus a nonce so the same signature can't be replayed (otherwise this
// would still trip signature-replay-risk on its own).
pragma solidity 0.8.24;

contract CheckedEcrecover {
  address public owner;
  mapping(address => uint256) public nonces;

  function isOwnerSignature(uint256 nonce, bytes32 hash, uint8 v, bytes32 r, bytes32 s) public view returns (bool) {
    require(nonce == nonces[owner], "bad nonce");
    address signer = ecrecover(hash, v, r, s);
    require(signer != address(0), "invalid signature");
    return signer == owner;
  }
}
