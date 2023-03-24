// Two variable-length parameters packed together with no length
// delimiter - encodePacked("a","bc") and encodePacked("ab","c") hash
// identically, breaking any uniqueness assumption built on this.
pragma solidity 0.8.24;

contract PackedHashCollision {
  mapping(bytes32 => bool) public seen;

  function register(string memory firstName, string memory lastName) public {
    bytes32 id = keccak256(abi.encodePacked(firstName, lastName));
    seen[id] = true;
  }
}
