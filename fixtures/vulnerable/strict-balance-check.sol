// A "fully funded" check that breaks the moment anyone force-sends extra
// ether via selfdestruct - which requires no permission on this contract
// at all.
pragma solidity 0.8.24;

contract StrictBalanceCheck {
  uint256 public constant TARGET = 10 ether;

  function isFullyFunded() public view returns (bool) {
    return address(this).balance == TARGET;
  }
}
