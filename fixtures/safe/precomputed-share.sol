// The same distribution, but msg.value is read exactly once, before the
// loop, to compute each recipient's share - the loop body itself never
// re-reads the fixed per-transaction total.
pragma solidity 0.8.24;

contract PrecomputedShare {
  function distribute(address[] calldata recipients) external payable {
    uint256 share = msg.value / recipients.length;
    uint256 i = 0;
    while (i < recipients.length) {
      payable(recipients[i]).transfer(share);
      i++;
    }
  }
}
