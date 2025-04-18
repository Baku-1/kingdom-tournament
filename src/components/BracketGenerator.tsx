import React, { useEffect, useState } from 'react';

interface Participant {
  address: string;
  name: string;
}

interface Match {
  id: number;
  round: number;
  player1: Participant | null;
  player2: Participant | null;
  winner: Participant | null;
  status: 'pending' | 'completed' | 'disputed';
  position: number;
}

interface Bracket {
  round: number;
  matches: Match[];
}

interface BracketGeneratorProps {
  tournamentId: string;
  participants: Participant[];
  registrationEndTime: Date;
  onBracketsGenerated: (brackets: Bracket[]) => void;
}

export default function BracketGenerator({
  tournamentId,
  participants,
  registrationEndTime,
  onBracketsGenerated
}: BracketGeneratorProps) {
  const [brackets, setBrackets] = useState<Bracket[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGenerated, setIsGenerated] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  // Calculate time remaining until registration ends
  useEffect(() => {
    const calculateTimeRemaining = () => {
      const now = new Date();
      const timeDiff = registrationEndTime.getTime() - now.getTime();
      
      if (timeDiff <= 0) {
        setTimeRemaining('Registration closed');
        return true; // Registration has ended
      }
      
      const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
      
      setTimeRemaining(`${days}d ${hours}h ${minutes}m ${seconds}s`);
      return false; // Registration still ongoing
    };
    
    // Check if registration has already ended
    const registrationEnded = calculateTimeRemaining();
    
    // If registration has ended, generate brackets
    if (registrationEnded && !isGenerated && participants.length > 0) {
      generateBrackets();
    }
    
    // Update timer every second
    const timer = setInterval(() => {
      const registrationEnded = calculateTimeRemaining();
      
      // If registration just ended, generate brackets
      if (registrationEnded && !isGenerated && participants.length > 0) {
        generateBrackets();
      }
    }, 1000);
    
    return () => clearInterval(timer);
  }, [registrationEndTime, isGenerated, participants]);

  // Generate brackets based on number of participants
  const generateBrackets = async () => {
    if (isGenerating || isGenerated) return;
    
    setIsGenerating(true);
    
    try {
      // Get the number of participants
      const numParticipants = participants.length;
      
      if (numParticipants < 2) {
        console.error('Not enough participants to generate brackets');
        setIsGenerating(false);
        return;
      }
      
      // Calculate the number of rounds needed
      // For a single elimination tournament with n participants, we need log2(n) rounds (rounded up)
      // If n is not a power of 2, some participants will get byes in the first round
      const numRounds = Math.ceil(Math.log2(numParticipants));
      
      // Calculate the number of matches in a perfect bracket
      const perfectBracketSize = Math.pow(2, numRounds);
      
      // Shuffle participants to randomize the bracket
      const shuffledParticipants = [...participants].sort(() => Math.random() - 0.5);
      
      // Create brackets
      const generatedBrackets: Bracket[] = [];
      
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
        
        generatedBrackets.push({
          round,
          matches
        });
      }
      
      // Propagate winners from byes to the next round
      for (let round = 1; round < numRounds; round++) {
        const currentRoundMatches = generatedBrackets[round - 1].matches;
        const nextRoundMatches = generatedBrackets[round].matches;
        
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
      
      setBrackets(generatedBrackets);
      setIsGenerated(true);
      
      // Call the callback with the generated brackets
      onBracketsGenerated(generatedBrackets);
      
    } catch (error) {
      console.error('Error generating brackets:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Force generate brackets (for testing or admin override)
  const handleForceGenerate = () => {
    if (!isGenerated && participants.length >= 2) {
      generateBrackets();
    }
  };

  return (
    <div className="bracket-generator">
      {!isGenerated ? (
        <div className="p-4 border border-gray-200 rounded-md">
          <h3 className="text-lg font-medium mb-2">Tournament Brackets</h3>
          
          {new Date() < registrationEndTime ? (
            <>
              <p className="mb-2">Brackets will be generated automatically when registration ends.</p>
              <p className="text-sm text-gray-600">Registration ends in: {timeRemaining}</p>
              <p className="text-sm text-gray-600 mt-2">Current participants: {participants.length}</p>
              
              {/* Admin override button (could be hidden for non-admins) */}
              <button
                onClick={handleForceGenerate}
                className="mt-4 px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 text-sm"
                disabled={isGenerating || participants.length < 2}
              >
                {isGenerating ? 'Generating...' : 'Force Generate Brackets (Admin)'}
              </button>
            </>
          ) : (
            <>
              <p className="mb-2">Registration has ended.</p>
              {participants.length < 2 ? (
                <p className="text-red-500">Not enough participants to generate brackets.</p>
              ) : (
                <p className="text-sm text-gray-600">Generating brackets for {participants.length} participants...</p>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="p-4 border border-gray-200 rounded-md">
          <h3 className="text-lg font-medium mb-2">Tournament Brackets Generated</h3>
          <p className="text-sm text-gray-600">Brackets have been generated for {participants.length} participants.</p>
          <p className="text-sm text-gray-600">Total rounds: {brackets.length}</p>
        </div>
      )}
    </div>
  );
}
