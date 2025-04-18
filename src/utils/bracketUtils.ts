// Types
export interface Participant {
  address: string;
  name: string;
}

export interface Match {
  id: number;
  round: number;
  player1: Participant | null;
  player2: Participant | null;
  winner: Participant | null;
  status: 'pending' | 'completed' | 'disputed';
  position: number;
}

export interface Bracket {
  round: number;
  matches: Match[];
}

/**
 * Generate tournament brackets based on the number of participants
 * @param participants List of tournament participants
 * @returns Array of brackets with matches
 */
export function generateBrackets(participants: Participant[]): Bracket[] {
  const numParticipants = participants.length;
  
  if (numParticipants < 2) {
    throw new Error('Not enough participants to generate brackets');
  }
  
  // Calculate the number of rounds needed
  const numRounds = Math.ceil(Math.log2(numParticipants));
  
  // Shuffle participants to randomize the bracket
  const shuffledParticipants = [...participants].sort(() => Math.random() - 0.5);
  
  // Create brackets
  const brackets: Bracket[] = [];
  
  // Generate matches for each round
  for (let round = 1; round <= numRounds; round++) {
    const numMatchesInRound = Math.pow(2, numRounds - round);
    const matches: Match[] = [];
    
    for (let i = 0; i < numMatchesInRound; i++) {
      // For the first round, assign participants or byes
      if (round === 1) {
        const player1Index = i * 2;
        const player2Index = i * 2 + 1;
        
        const match: Match = {
          id: i + 1,
          round,
          player1: player1Index < shuffledParticipants.length ? shuffledParticipants[player1Index] : null,
          player2: player2Index < shuffledParticipants.length ? shuffledParticipants[player2Index] : null,
          winner: null,
          status: 'pending',
          position: i
        };
        
        // If player2 is null (bye), player1 automatically advances
        if (match.player1 && !match.player2) {
          match.winner = match.player1;
          match.status = 'completed';
        }
        
        matches.push(match);
      } else {
        // For subsequent rounds, create empty matches
        matches.push({
          id: i + 1,
          round,
          player1: null,
          player2: null,
          winner: null,
          status: 'pending',
          position: i
        });
      }
    }
    
    brackets.push({
      round,
      matches
    });
  }
  
  // Propagate winners from byes to the next round
  for (let round = 1; round < numRounds; round++) {
    const currentRoundMatches = brackets[round - 1].matches;
    const nextRoundMatches = brackets[round].matches;
    
    for (let i = 0; i < currentRoundMatches.length; i++) {
      const match = currentRoundMatches[i];
      if (match.status === 'completed' && match.winner) {
        const nextRoundMatchIndex = Math.floor(i / 2);
        const isFirstPlayer = i % 2 === 0;
        
        if (isFirstPlayer) {
          nextRoundMatches[nextRoundMatchIndex].player1 = match.winner;
        } else {
          nextRoundMatches[nextRoundMatchIndex].player2 = match.winner;
        }
      }
    }
  }
  
  return brackets;
}

/**
 * Calculate the next power of 2 greater than or equal to n
 * @param n Number to find next power of 2 for
 * @returns Next power of 2
 */
export function nextPowerOf2(n: number): number {
  return Math.pow(2, Math.ceil(Math.log2(n)));
}

/**
 * Check if a tournament has enough participants to generate brackets
 * @param participants List of tournament participants
 * @returns Boolean indicating if brackets can be generated
 */
export function canGenerateBrackets(participants: Participant[]): boolean {
  return participants.length >= 2;
}

/**
 * Update brackets with a match result
 * @param brackets Current tournament brackets
 * @param roundIndex Index of the round (0-based)
 * @param matchIndex Index of the match in the round (0-based)
 * @param winner Winner of the match
 * @returns Updated brackets
 */
export function updateBracketsWithResult(
  brackets: Bracket[],
  roundIndex: number,
  matchIndex: number,
  winner: Participant
): Bracket[] {
  // Create a deep copy of brackets to avoid mutating the original
  const updatedBrackets = JSON.parse(JSON.stringify(brackets));
  
  // Update the match with the winner
  const match = updatedBrackets[roundIndex].matches[matchIndex];
  match.winner = winner;
  match.status = 'completed';
  
  // If this is not the final round, update the next round's match
  if (roundIndex < updatedBrackets.length - 1) {
    const nextRoundMatchIndex = Math.floor(matchIndex / 2);
    const isFirstPlayer = matchIndex % 2 === 0;
    
    // Update the next round's match with the winner
    if (isFirstPlayer) {
      updatedBrackets[roundIndex + 1].matches[nextRoundMatchIndex].player1 = winner;
    } else {
      updatedBrackets[roundIndex + 1].matches[nextRoundMatchIndex].player2 = winner;
    }
  }
  
  return updatedBrackets;
}
