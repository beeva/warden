// A one-line setter with no guard against the zero address - calling it
// with address(0) permanently locks the contract out of the owner role.
pragma solidity 0.8.24;

contract OwnershipSetter {
  address public owner;

  constructor() {
    owner = msg.sender;
  }

  function setOwner(address newOwner) external {
    owner = newOwner;
  }
}
