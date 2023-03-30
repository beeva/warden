// The fixed counterpart to fixtures/vulnerable/origin-recipient.sol:
// value goes to msg.sender, the actual immediate caller.
pragma solidity 0.8.24;

contract SenderRecipient {
  function withdraw() public {
    payable(msg.sender).transfer(1 ether);
  }
}
