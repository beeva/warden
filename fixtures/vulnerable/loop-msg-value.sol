// Intends to split the sent ether evenly across recipients, but reads
// msg.value inside the loop - it's the same fixed total on every pass,
// so this sends the FULL amount to every recipient instead of a share
// of it, draining far more than was actually sent in.
pragma solidity 0.8.24;

contract LoopMsgValue {
  function distribute(address[] calldata recipients) external payable {
    uint256 i = 0;
    while (i < recipients.length) {
      payable(recipients[i]).transfer(msg.value);
      i++;
    }
  }
}
