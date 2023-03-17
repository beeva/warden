// The fixed counterpart to fixtures/vulnerable/stuck-ether.sol: a
// withdraw function gives depositors a real path to get their ether
// back out.
pragma solidity 0.8.24;

contract WithdrawableEther {
  mapping(address => uint256) public deposits;

  receive() external payable {
    deposits[msg.sender] += msg.value;
  }

  function withdraw(uint256 amount) public {
    deposits[msg.sender] -= amount;
    payable(msg.sender).transfer(amount);
  }
}
