// The fixed counterpart to fixtures/vulnerable/strict-balance-check.sol:
// >= isn't broken by an unexpected extra balance the way == is.
pragma solidity 0.8.24;

contract ThresholdBalanceCheck {
  uint256 public constant TARGET = 10 ether;

  function isFullyFunded() public view returns (bool) {
    return address(this).balance >= TARGET;
  }
}
