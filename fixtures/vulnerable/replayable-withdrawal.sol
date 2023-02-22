// A signed withdrawal authorization with no nonce or used-signature
// tracking - the exact same signature can be submitted again and again.
pragma solidity 0.8.24;

contract ReplayableWithdrawal {
  mapping(address => uint256) public balances;

  function withdraw(uint256 amount, bytes32 hash, bytes32 r, bytes32 s, uint8 v) public {
    address signer = ecrecover(hash, v, r, s);
    require(signer != address(0), "bad signature");
    balances[signer] -= amount;
  }
}
