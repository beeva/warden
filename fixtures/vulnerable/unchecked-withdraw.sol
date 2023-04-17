// Shaves gas off the balance update by opting out of 0.8's default
// underflow check - but there's no guard here ensuring the caller's
// balance actually covers amount, so the subtraction can wrap around
// to a huge number instead of reverting.
pragma solidity 0.8.24;

contract UncheckedWithdraw {
  mapping(address => uint256) public balances;

  function withdraw(uint256 amount) external {
    unchecked {
      balances[msg.sender] -= amount;
    }
    (bool ok, ) = msg.sender.call{value: amount}("");
    require(ok);
  }
}
