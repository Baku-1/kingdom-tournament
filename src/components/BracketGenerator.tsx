import React, { useEffect, useState } from 'react';
import { Bracket, Match, Participant, TournamentType } from '@/utils/bracketUtils';

interface BracketGeneratorProps {
  tournamentId: string;
  participants: Participant[];
  registrationEndTime: Date;
  tournamentType?: TournamentType;
  onBracketsGenerated: (brackets: Bracket[]) => void;
}

export default function BracketGenerator({
  tournamentId,
  participants,
  registrationEndTime,
  tournamentType = 'single-elimination',
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

      // Import the bracket generation function from utils
      const { generateBrackets } = await import('@/utils/bracketUtils');

      // Generate brackets using the utility function
      const generatedBrackets = generateBrackets(participants, tournamentType);

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
