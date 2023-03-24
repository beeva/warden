// The fixed counterpart to fixtures/vulnerable/packed-hash-collision.sol:
// abi.encode length-prefixes each argument, so distinct inputs can't
// collide the way abi.encodePacked's raw concatenation can.
pragma solidity 0.8.24;

contract EncodedNoCollision {
  mapping(bytes32 => bool) public seen;

  function register(string memory firstName, string memory lastName) public {
    bytes32 id = keccak256(abi.encode(firstName, lastName));
    seen[id] = true;
  }
}
