// The fixed counterpart to fixtures/vulnerable/payout-loop.sol: each
// recipient claims their own funds in their own transaction instead of
// being pushed to in one loop, so gas cost never depends on how many
// other recipients exist.
pragma solidity 0.8.24;

contract PullPayment {
  mapping(address => uint256) public owed;

  function credit(address who, uint256 amount) external {
    owed[who] += amount;
  }

  function claim() external {
    uint256 amount = owed[msg.sender];
    owed[msg.sender] = 0;
    (bool ok, ) = msg.sender.call{value: amount}("");
    require(ok, "claim failed");
  }
}
