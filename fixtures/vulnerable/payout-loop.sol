// Pays every recipient in one transaction - gas cost grows with the
// recipient list's size, so this becomes permanently uncallable once the
// list grows past the block gas limit. Compare fixtures/safe/pull-payment.sol.
pragma solidity 0.8.24;

contract PayoutLoop {
  address payable[] public recipients;

  function addRecipient(address payable r) external {
    recipients.push(r);
  }

  function payAll() external {
    for (uint256 i = 0; i < recipients.length; i++) {
      recipients[i].transfer(1 ether);
    }
  }
}
