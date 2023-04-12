// The same fee split, reordered to multiply before it divides - the
// truncation happens once, at the very end, instead of compounding.
pragma solidity 0.8.24;

contract PrecisionSafeFee {
  uint256 public constant FEE_BPS = 50; // 0.5%

  function feeOn(uint256 amount) public pure returns (uint256) {
    return (amount * FEE_BPS) / 10000;
  }
}
