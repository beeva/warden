// A textbook checks-effects-interactions violation: the external call
// happens before the balance is zeroed, and the call's own success
// isn't checked either.
pragma solidity 0.8.24;

contract ReentrantVault {
  mapping(address => uint256) public balances;

  function deposit() external payable {
    balances[msg.sender] += msg.value;
  }

  function withdraw() external {
    uint256 amount = balances[msg.sender];
    msg.sender.call{value: amount}("");
    balances[msg.sender] = 0;
  }
}
