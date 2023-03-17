// Accepts ether via receive(), but nothing in the contract ever sends
// value back out - anything deposited here is permanently stuck.
pragma solidity 0.8.24;

contract StuckEther {
  mapping(address => uint256) public deposits;

  receive() external payable {
    deposits[msg.sender] += msg.value;
  }
}
