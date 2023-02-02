// A lottery that closes on a raw timestamp check and picks a winner from
// a hash of block properties - both are within a block producer's reach.
pragma solidity 0.8.24;

contract Lottery {
  address[] public players;
  uint256 public deadline;

  constructor(uint256 durationSeconds) {
    deadline = block.timestamp + durationSeconds;
  }

  function enter() external {
    require(block.timestamp < deadline, "lottery closed");
    players.push(msg.sender);
  }

  function pickWinner() external view returns (address) {
    uint256 index = uint256(keccak256(abi.encodePacked(block.timestamp, block.difficulty))) % players.length;
    return players[index];
  }
}
