// No access control at all - any caller names the destination and drains
// the contract's entire balance to it.
pragma solidity 0.8.24;

contract OpenDrain {
  function drain(address payable to) public {
    to.transfer(address(this).balance);
  }
}
