// The fixed counterpart to fixtures/vulnerable/ownership-setter.sol: a
// real zero-address guard before the assignment.
pragma solidity 0.8.24;

contract CheckedSetter {
  address public owner;

  constructor() {
    owner = msg.sender;
  }

  function setOwner(address newOwner) external {
    require(newOwner != address(0), "zero address");
    owner = newOwner;
  }
}
