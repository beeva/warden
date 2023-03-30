// Sends value to tx.origin instead of msg.sender - a malicious contract
// a victim interacts with can exploit the same confused-deputy gap
// tx.origin-based auth has.
pragma solidity 0.8.24;

contract OriginRecipient {
  function withdraw() public {
    tx.origin.transfer(1 ether);
  }
}
