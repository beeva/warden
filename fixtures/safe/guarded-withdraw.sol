// The fixed counterpart to fixtures/vulnerable/open-drain.sol: only the
// owner can call it.
pragma solidity 0.8.24;

contract GuardedWithdraw {
  address public owner;

  constructor() {
    owner = msg.sender;
  }

  modifier onlyOwner() {
    require(msg.sender == owner, "not owner");
    _;
  }

  function withdraw(address payable to) public onlyOwner {
    to.transfer(address(this).balance);
  }
}
