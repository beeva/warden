// A fee split that divides before it multiplies - for a small enough
// `amount`, the intermediate division truncates to zero and every payee
// receives nothing, even though the fee rate itself is nonzero.
pragma solidity 0.8.24;

contract PrecisionLossFee {
  uint256 public constant FEE_BPS = 50; // 0.5%

  function feeOn(uint256 amount) public pure returns (uint256) {
    return (amount / 10000) * FEE_BPS;
  }
}
