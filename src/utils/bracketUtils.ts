// Types
export interface Participant {
  address: string;
  name: string;
  seed?: number;
  status?: 'active' | 'eliminated';
}

export interface Match {
  id: number;
  round: number;
  player1: Participant | null;
  player2: Participant | null;
  winner: Participant | null;
  loser: Participant | null;
  status: 'pending' | 'completed' | 'disputed';
  position: number;
  bracketType?: 'winners' | 'losers' | 'finals';
  matchType?: 'normal' | 'bronze' | 'finals' | 'grand_finals';
}

export interface Bracket {
  round: number;
  matches: Match[];
  bracketType: 'winners' | 'losers' | 'finals';
}

export type TournamentType = 'single-elimination' | 'double-elimination';

/**
 * Generate tournament brackets based on the number of participants
 * @param participants List of tournament participants
 * @param tournamentType Type of tournament (single or double elimination)
 * @returns Array of brackets with matches
 */
export function generateBrackets(
  participants: Participant[],
  tournamentType: TournamentType = 'single-elimination'
): Bracket[] {
  const numParticipants = participants.length;

  if (numParticipants < 2) {
    throw new Error('Not enough participants to generate brackets');
  }

  // Seed participants (assign seed numbers)
  const seededParticipants = seedParticipants(participants);

  // Generate brackets based on tournament type
  return tournamentType === 'single-elimination'
    ? generateSingleEliminationBrackets(seededParticipants)
    : generateDoubleEliminationBrackets(seededParticipants);
}

/**
 * Seed participants for a tournament
 * @param participants List of tournament participants
 * @returns Seeded participants
 */
function seedParticipants(participants: Participant[]): Participant[] {
  // Create a copy of participants to avoid mutating the original
  const seededParticipants = [...participants];

  // Shuffle participants to randomize seeding
  const shuffledParticipants = seededParticipants.sort(() => Math.random() - 0.5);

  // Assign seed numbers
  return shuffledParticipants.map((participant, index) => ({
    ...participant,
    seed: index + 1,
    status: 'active'
  }));
}

/**
 * Generate brackets for a single elimination tournament
 * @param participants Seeded participants
 * @returns Array of brackets with matches
 */
function generateSingleEliminationBrackets(participants: Participant[]): Bracket[] {
  const numParticipants = participants.length;
  const numRounds = Math.ceil(Math.log2(numParticipants));
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

        // Generate a unique ID for each match that includes round and position
        const uniqueId = (round * 100) + i + 1;

        const match: Match = {
          id: uniqueId,
          round,
          player1: player1Index < participants.length ? participants[player1Index] : null,
          player2: player2Index < participants.length ? participants[player2Index] : null,
          winner: null,
          loser: null,
          status: 'pending',
          position: i,
          bracketType: 'winners',
          matchType: 'normal'
        };

        // If player2 is null (bye), player1 automatically advances
        // But only in early rounds, not in the final rounds
        if (match.player1 && !match.player2) {
          // Check if this is one of the last two rounds (semi-finals or finals)
          const isLastTwoRounds = round >= numRounds - 1;

          // Only auto-advance if not in the last two rounds
          if (!isLastTwoRounds) {
            match.winner = match.player1;
            match.status = 'completed';
          }
        }

        matches.push(match);
      } else {
        // For subsequent rounds, create empty matches
        const matchType = round === numRounds ? 'finals' : 'normal';

        // Generate a unique ID for each match that includes round and position
        // This ensures matches in the same round have different IDs
        const uniqueId = (round * 100) + i + 1;

        matches.push({
          id: uniqueId,
          round,
          player1: null,
          player2: null,
          winner: null,
          loser: null,
          status: 'pending',
          position: i,
          bracketType: 'winners',
          matchType
        });
      }
    }

    brackets.push({
      round,
      matches,
      bracketType: 'winners'
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
 * Generate brackets for a double elimination tournament
 * @param participants Seeded participants
 * @returns Array of brackets with matches
 */
function generateDoubleEliminationBrackets(participants: Participant[]): Bracket[] {
  const numParticipants = participants.length;

  // Generate winners bracket (same as single elimination)
  const winnersBrackets = generateSingleEliminationBrackets(participants);

  // Calculate the number of rounds in the losers bracket
  // In double elimination, losers bracket has 2 * log2(n) - 1 rounds
  const numWinnersRounds = Math.ceil(Math.log2(numParticipants));
  const numLosersRounds = 2 * numWinnersRounds - 1;

  // Generate losers bracket
  const losersBrackets: Bracket[] = [];

  // In double elimination, losers bracket has a more complex structure
  // with two matches per "round" in the traditional sense
  for (let round = 1; round <= numLosersRounds; round++) {
    const isEvenRound = round % 2 === 0;

    // Number of matches depends on the round
    // Odd rounds receive losers from winners bracket
    // Even rounds are between losers bracket winners
    let numMatchesInRound;

    if (round === 1) {
      numMatchesInRound = Math.floor(numParticipants / 4);
    } else if (isEvenRound) {
      numMatchesInRound = losersBrackets[round - 2].matches.length;
    } else { // odd round > 1
      numMatchesInRound = Math.ceil(losersBrackets[round - 2].matches.length / 2);
    }

    // Ensure at least one match
    numMatchesInRound = Math.max(1, numMatchesInRound);

    const matches: Match[] = [];

    for (let i = 0; i < numMatchesInRound; i++) {
      // Generate a unique ID for losers bracket matches
      // Use 300 as base for losers bracket to differentiate from winners bracket
      const uniqueId = 300 + (round * 100) + i + 1;

      matches.push({
        id: uniqueId,
        round,
        player1: null,
        player2: null,
        winner: null,
        loser: null,
        status: 'pending',
        position: i,
        bracketType: 'losers',
        matchType: 'normal'
      });
    }

    losersBrackets.push({
      round,
      matches,
      bracketType: 'losers'
    });
  }

  // Generate finals bracket (winners bracket champion vs losers bracket champion)
  const finalsBracket: Bracket = {
    round: 1,
    matches: [
      {
        // Use 900 as base for finals bracket to differentiate from other brackets
        id: 901,
        round: 1,
        player1: null, // Winners bracket champion
        player2: null, // Losers bracket champion
        winner: null,
        loser: null,
        status: 'pending',
        position: 0,
        bracketType: 'finals',
        matchType: 'finals'
      }
    ],
    bracketType: 'finals'
  };

  // Add potential second finals match (if losers bracket champion wins first finals match)
  finalsBracket.matches.push({
    // Use 902 for grand finals match
    id: 902,
    round: 2,
    player1: null,
    player2: null,
    winner: null,
    loser: null,
    status: 'pending',
    position: 0,
    bracketType: 'finals',
    matchType: 'grand_finals'
  });

  // Combine all brackets
  return [...winnersBrackets, ...losersBrackets, finalsBracket];
}

/**
 * Get the next available match ID
 * @param brackets Existing brackets
 * @returns Next available match ID
 *
 * Note: This function is exported for potential future use in dynamic bracket generation
 */
export function getNextMatchId(brackets: Bracket[]): number {
  let maxId = 0;

  for (const bracket of brackets) {
    for (const match of bracket.matches) {
      if (match.id > maxId) {
        maxId = match.id;
      }
    }
  }

  return maxId + 1;
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
 * @param matchId ID of the match to update
 * @param winnerId ID of the winning participant
 * @param tournamentType Type of tournament (single or double elimination)
 * @returns Updated brackets
 */
export function updateBracketsWithResult(
  brackets: Bracket[],
  matchId: number,
  winnerId: string,
  tournamentType: TournamentType = 'single-elimination'
): Bracket[] {
  // Create a deep copy of brackets to avoid mutating the original
  const updatedBrackets = JSON.parse(JSON.stringify(brackets)) as Bracket[];

  // Find the match to update
  let matchBracketIndex = -1;
  let matchIndex = -1;
  let match: Match | null = null;

  for (let i = 0; i < updatedBrackets.length; i++) {
    const bracketMatchIndex = updatedBrackets[i].matches.findIndex(m => m.id === matchId);
    if (bracketMatchIndex !== -1) {
      matchBracketIndex = i;
      matchIndex = bracketMatchIndex;
      match = updatedBrackets[i].matches[bracketMatchIndex];
      break;
    }
  }

  if (!match) {
    throw new Error(`Match with ID ${matchId} not found`);
  }

  // Determine winner and loser
  const winner = match.player1?.address === winnerId ? match.player1 : match.player2;
  const loser = match.player1?.address === winnerId ? match.player2 : match.player1;

  if (!winner) {
    throw new Error(`Winner with ID ${winnerId} not found in match`);
  }

  // Update match with winner and loser
  match.winner = winner;
  match.loser = loser;
  match.status = 'completed';

  // Update participant statuses
  if (winner) winner.status = 'active';
  if (loser) loser.status = tournamentType === 'single-elimination' ? 'eliminated' : 'active';

  // Handle tournament progression based on tournament type
  if (tournamentType === 'single-elimination') {
    updateSingleEliminationProgress(updatedBrackets, matchBracketIndex, matchIndex, winner);
  } else {
    updateDoubleEliminationProgress(updatedBrackets, matchBracketIndex, matchIndex, winner, loser);
  }

  return updatedBrackets;
}

/**
 * Update single elimination tournament progress
 * @param brackets Current tournament brackets
 * @param bracketIndex Index of the bracket containing the match
 * @param matchIndex Index of the match in the bracket
 * @param winner Winner of the match
 */
function updateSingleEliminationProgress(
  brackets: Bracket[],
  bracketIndex: number,
  matchIndex: number,
  winner: Participant
): void {
  const currentBracket = brackets[bracketIndex];
  const currentMatch = currentBracket.matches[matchIndex];

  // Check if this is the last round of the winners bracket (semi-finals)
  const isLastWinnersRound = currentBracket.bracketType === 'winners' &&
    !brackets.some(b => b.bracketType === 'winners' && b.round > currentBracket.round);

  // If this is the last winners round, check if we need to advance to finals
  if (isLastWinnersRound) {
    // Look for a finals bracket
    const finalsBracket = brackets.find(b => b.bracketType === 'finals');

    if (finalsBracket && finalsBracket.matches.length > 0) {
      // This is the finals match
      const finalsMatch = finalsBracket.matches[0];

      // Find all matches in the current round
      const semifinalMatches = currentBracket.matches;

      // Sort matches by position to ensure consistent ordering
      const sortedSemifinalMatches = [...semifinalMatches].sort((a, b) => a.position - b.position);

      // Find the index of the current match in the sorted semifinals
      const semifinalIndex = sortedSemifinalMatches.findIndex(m => m.id === currentMatch.id);

      console.log(`Semi-final match index: ${semifinalIndex}, Total semi-finals: ${sortedSemifinalMatches.length}`);

      // Determine if this is the first or second semi-final match based on sorted index
      if (semifinalIndex === 1) {
        // First semi-final winner goes to player1
        finalsMatch.player1 = winner;
        console.log(`Advanced ${winner.name} to finals as player1 (from first semifinal)`);
      } else if (semifinalIndex === 2) {
        // Second semi-final winner goes to player2
        finalsMatch.player2 = winner;
        console.log(`Advanced ${winner.name} to finals as player2 (from second semifinal)`);
      } else if (semifinalIndex > 2) {
        // Handle any other valid index as player2 to be more robust
        finalsMatch.player2 = winner;
        console.log(`Advanced ${winner.name} to finals as player2 (from semifinal at position ${semifinalIndex})`);
      } else {
        // This shouldn't happen in a normal tournament, but log it if it does
        console.warn(`Unexpected semi-final index: ${semifinalIndex}. Winner ${winner.name} not advanced to finals.`);
      }
    }
  }
  // If this is not the final round, update the next round's match within winners bracket
  else if (currentBracket.bracketType === 'winners') {
    const nextBracket = brackets.find(b => b.bracketType === 'winners' && b.round === currentBracket.round + 1);

    if (nextBracket) {
      const nextRoundMatchIndex = Math.floor(matchIndex / 2);
      const isFirstPlayer = matchIndex % 2 === 0;

      // Make sure the next match exists
      if (nextRoundMatchIndex < nextBracket.matches.length) {
        // Update the next round's match with the winner
        if (isFirstPlayer) {
          nextBracket.matches[nextRoundMatchIndex].player1 = winner;
        } else {
          nextBracket.matches[nextRoundMatchIndex].player2 = winner;
        }

        console.log(`Advanced ${winner.name} to next winners round`);
      }
    }
  }
}

/**
 * Update double elimination tournament progress
 * @param brackets Current tournament brackets
 * @param bracketIndex Index of the bracket containing the match
 * @param matchIndex Index of the match in the bracket
 * @param winner Winner of the match
 * @param loser Loser of the match
 */
function updateDoubleEliminationProgress(
  brackets: Bracket[],
  bracketIndex: number,
  matchIndex: number,
  winner: Participant,
  loser: Participant | null
): void {
  const currentBracket = brackets[bracketIndex];
  const currentMatch = currentBracket.matches[matchIndex];

  // Handle progression based on bracket type
  if (currentBracket.bracketType === 'winners') {
    // Winner advances in winners bracket
    const nextWinnersBracket = brackets.find(
      b => b.bracketType === 'winners' && b.round === currentBracket.round + 1
    );

    if (nextWinnersBracket) {
      const nextRoundMatchIndex = Math.floor(matchIndex / 2);
      const isFirstPlayer = matchIndex % 2 === 0;

      if (nextRoundMatchIndex < nextWinnersBracket.matches.length) {
        if (isFirstPlayer) {
          nextWinnersBracket.matches[nextRoundMatchIndex].player1 = winner;
        } else {
          nextWinnersBracket.matches[nextRoundMatchIndex].player2 = winner;
        }
      }
    }

    // Loser drops to losers bracket (if not a bye)
    if (loser) {
      // Find the appropriate losers bracket round
      // In double elimination, losers from winners round N go to losers round 2N-1
      const losersRound = 2 * currentBracket.round - 1;
      const losersBracket = brackets.find(
        b => b.bracketType === 'losers' && b.round === losersRound
      );

      if (losersBracket) {
        // Calculate which match in the losers bracket this loser goes to
        // This depends on the structure of the losers bracket
        const losersMatchIndex = Math.floor(matchIndex / 2);

        if (losersMatchIndex < losersBracket.matches.length) {
          // Assign to player1 or player2 based on a pattern
          const isFirstPlayer = (matchIndex % 2 === 0);

          if (isFirstPlayer) {
            losersBracket.matches[losersMatchIndex].player1 = loser;
          } else {
            losersBracket.matches[losersMatchIndex].player2 = loser;
          }
        }
      }
    }
  } else if (currentBracket.bracketType === 'losers') {
    // Winner advances in losers bracket
    const nextLosersRound = currentBracket.round + 1;
    const nextLosersBracket = brackets.find(
      b => b.bracketType === 'losers' && b.round === nextLosersRound
    );

    if (nextLosersBracket) {
      // In losers bracket, the pattern of advancement depends on whether
      // the current round is odd or even
      const isCurrentRoundOdd = currentBracket.round % 2 === 1;

      if (isCurrentRoundOdd) {
        // In odd rounds, winners advance to the next round at the same position
        nextLosersBracket.matches[matchIndex].player1 = winner;
      } else {
        // In even rounds, winners advance to the next round at half the position
        const nextMatchIndex = Math.floor(matchIndex / 2);
        const isFirstPlayer = matchIndex % 2 === 0;

        if (nextMatchIndex < nextLosersBracket.matches.length) {
          if (isFirstPlayer) {
            nextLosersBracket.matches[nextMatchIndex].player1 = winner;
          } else {
            nextLosersBracket.matches[nextMatchIndex].player2 = winner;
          }
        }
      }
    }

    // If this is the final losers bracket match, winner advances to finals
    if (currentBracket.round === brackets.filter(b => b.bracketType === 'losers').length) {
      const finalsBracket = brackets.find(b => b.bracketType === 'finals');

      if (finalsBracket && finalsBracket.matches.length > 0) {
        finalsBracket.matches[0].player2 = winner; // Losers bracket champion is player2 in finals
      }
    }

    // Loser is eliminated
    if (loser) {
      loser.status = 'eliminated';
    }
  } else if (currentBracket.bracketType === 'finals') {
    // Handle finals matches
    if (currentMatch.matchType === 'finals') {
      // If winners bracket champion (player1) wins, tournament is over
      if (winner === currentMatch.player1) {
        // Tournament is complete, no need for grand finals
        // Mark the grand finals match as completed with the same winner
        if (currentBracket.matches.length > 1) {
          const grandFinalsMatch = currentBracket.matches[1];
          grandFinalsMatch.status = 'completed';
          grandFinalsMatch.winner = winner;
          grandFinalsMatch.player1 = currentMatch.player1;
          grandFinalsMatch.player2 = currentMatch.player2;
        }
      } else {
        // If losers bracket champion (player2) wins, proceed to grand finals
        if (currentBracket.matches.length > 1) {
          const grandFinalsMatch = currentBracket.matches[1];
          grandFinalsMatch.player1 = currentMatch.player1; // Winners bracket champion
          grandFinalsMatch.player2 = winner; // Losers bracket champion who won first finals
        }
      }
    }
    // Grand finals match determines the overall champion
  }
}

/**
 * Check if a tournament is complete
 * @param brackets Tournament brackets
 * @param tournamentType Type of tournament
 * @returns Boolean indicating if the tournament is complete
 */
export function isTournamentComplete(
  brackets: Bracket[],
  tournamentType: TournamentType = 'single-elimination'
): boolean {
  if (tournamentType === 'single-elimination') {
    // First check if there's a dedicated finals bracket
    const finalsBracket = brackets.find(b => b.bracketType === 'finals');
    if (finalsBracket) {
      return finalsBracket.matches.some(m => m.status === 'completed' && m.winner !== null);
    }

    // Fallback: check the last match in the winners bracket
    const lastWinnersBracket = brackets.find(b => b.bracketType === 'winners' &&
      b.round === Math.max(...brackets.filter(b => b.bracketType === 'winners').map(b => b.round)));

    return lastWinnersBracket?.matches.some(m => m.status === 'completed' && m.winner !== null) ?? false;
  } else {
    // In double elimination, tournament is complete when either:
    // 1. The first finals match is complete with winners bracket champion as winner
    // 2. The grand finals match is complete
    const finalsBracket = brackets.find(b => b.bracketType === 'finals');

    if (!finalsBracket) return false;

    const finalsMatch = finalsBracket.matches.find(m => m.matchType === 'finals');
    const grandFinalsMatch = finalsBracket.matches.find(m => m.matchType === 'grand_finals');

    if (!finalsMatch) return false;

    // If winners bracket champion won the finals, tournament is complete
    if (finalsMatch.status === 'completed' && finalsMatch.winner === finalsMatch.player1) {
      return true;
    }

    // Otherwise, check if grand finals is complete
    return grandFinalsMatch?.status === 'completed' && grandFinalsMatch.winner !== null;
  }
}

/**
 * Get the tournament champion
 * @param brackets Tournament brackets
 * @param tournamentType Type of tournament
 * @returns The tournament champion or null if tournament is not complete
 */
export function getTournamentChampion(
  brackets: Bracket[],
  tournamentType: TournamentType = 'single-elimination'
): Participant | null {
  if (!isTournamentComplete(brackets, tournamentType)) {
    return null;
  }

  if (tournamentType === 'single-elimination') {
    // First check if there's a dedicated finals bracket
    const finalsBracket = brackets.find(b => b.bracketType === 'finals');
    if (finalsBracket && finalsBracket.matches.length > 0) {
      return finalsBracket.matches[0]?.winner ?? null;
    }

    // Fallback: check the last match in the winners bracket
    const lastWinnersBracket = brackets.find(b => b.bracketType === 'winners' &&
      b.round === Math.max(...brackets.filter(b => b.bracketType === 'winners').map(b => b.round)));

    return lastWinnersBracket?.matches[0]?.winner ?? null;
  } else {
    const finalsBracket = brackets.find(b => b.bracketType === 'finals');

    if (!finalsBracket) return null;

    const finalsMatch = finalsBracket.matches.find(m => m.matchType === 'finals');
    const grandFinalsMatch = finalsBracket.matches.find(m => m.matchType === 'grand_finals');

    // If winners bracket champion won the finals, they are the champion
    if (finalsMatch?.status === 'completed' && finalsMatch.winner === finalsMatch.player1) {
      return finalsMatch.winner;
    }

    // Otherwise, the grand finals winner is the champion
    return grandFinalsMatch?.winner ?? null;
  }
}
