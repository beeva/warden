// The fixed counterpart to fixtures/vulnerable/lottery.sol's winner-pick:
// randomness comes from a caller-supplied seed, not block properties. A
// real deployment would still want this to come from a VRF, but this
// specific fixture only exercises the block-entropy check.
pragma solidity 0.8.24;

contract SeededLottery {
  address[] public players;

  function pickWinner(uint256 seed) external view returns (address) {
    uint256 index = uint256(keccak256(abi.encodePacked(seed))) % players.length;
    return players[index];
  }
}
