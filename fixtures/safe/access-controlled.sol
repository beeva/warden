// The fixed counterpart to fixtures/vulnerable/backdoor-auth.sol: a real
// onlyOwner modifier checking msg.sender directly, not tx.origin behind
// a helper function.
pragma solidity 0.8.24;

contract AccessControlled {
  address public owner;

  constructor() {
    owner = msg.sender;
  }

  modifier onlyOwner() {
    require(msg.sender == owner, "not owner");
    _;
  }

  function kill() external onlyOwner {
    selfdestruct(payable(owner));
  }
}
