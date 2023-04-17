// The common gas-saving idiom: an unchecked block around a loop
// counter increment, never a subtraction - the direction that can
// actually underflow. The loop's own condition already bounds `i`, so
// opting out of the overflow check here costs nothing in safety.
pragma solidity 0.8.24;

contract GuardedUncheckedWithdraw {
  function sumTo(uint256 n) public pure returns (uint256 total) {
    for (uint256 i = 0; i < n; ) {
      total += i;
      unchecked {
        i++;
      }
    }
  }
}
