const CardGame = require('../gameEngine');

const game = new CardGame();
console.log('Initial deck length:', game.deck.length);

for (let i = 0; i < 3; i++) {
  const pCard = game.drawCard('player');
  const oCard = game.drawCard('opponent');
  console.log(`Round ${i + 1} - Player drew:`, pCard, ' | Opponent drew:', oCard);
}

console.log('Player hand:', game.playerHand);
console.log('Opponent hand:', game.opponentHand);
console.log('Deck remaining:', game.deck.length);
