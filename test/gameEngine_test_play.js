const CardGame = require('../gameEngine');

const game = new CardGame();

// Give player and opponent controlled hands for testing
game.playerHand = [
  { suit: 'hearts', rank: '4' },
  { suit: 'spades', rank: '4' },
  { suit: 'clubs', rank: '4' },
  { suit: 'diamonds', rank: 'K' }
];

game.opponentHand = [
  { suit: 'hearts', rank: '9' },
  { suit: 'spades', rank: '9' },
  { suit: 'clubs', rank: 'Q' }
];

console.log('Before play - Player hand:', JSON.stringify(game.playerHand));
console.log('Before play - Opponent hand:', JSON.stringify(game.opponentHand));

// Player plays two 4s
const playedByPlayer = game.playCard('player', [
  { suit: 'hearts', rank: '4' },
  { suit: 'spades', rank: '4' }
]);
console.log('Player played:', playedByPlayer);

// Opponent attempts to play two cards but they are different ranks -> should fail
const badPlay = game.playCard('opponent', [
  { suit: 'hearts', rank: '9' },
  { suit: 'clubs', rank: 'Q' }
]);
console.log('Opponent bad play (should be null):', badPlay);

// Opponent plays two 9s
const playedByOpp = game.playCard('opponent', [
  { suit: 'hearts', rank: '9' },
  { suit: 'spades', rank: '9' }
]);
console.log('Opponent played:', playedByOpp);

console.log('After play - Player hand:', JSON.stringify(game.playerHand));
console.log('After play - Opponent hand:', JSON.stringify(game.opponentHand));
console.log('Pile:', JSON.stringify(game.pile));
