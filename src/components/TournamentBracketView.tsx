import React from 'react';
import { Bracket, Match, Participant, TournamentType, isTournamentComplete, getTournamentChampion } from '@/utils/bracketUtils';

interface TournamentBracketViewProps {
  brackets: Bracket[];
  tournamentType: TournamentType;
  onReportMatch?: (match: Match) => void;
  connectedAddress?: string | null;
  isCreator?: boolean;
}

export default function TournamentBracketView({
  brackets,
  tournamentType,
  onReportMatch,
  connectedAddress,
  isCreator = false
}: TournamentBracketViewProps) {
  // Group brackets by type
  const winnersBrackets = brackets.filter(b => b.bracketType === 'winners').sort((a, b) => a.round - b.round);
  const losersBrackets = brackets.filter(b => b.bracketType === 'losers').sort((a, b) => a.round - b.round);
  const finalsBrackets = brackets.filter(b => b.bracketType === 'finals').sort((a, b) => a.round - b.round);

  // Check if tournament is complete
  const isComplete = isTournamentComplete(brackets, tournamentType);
  const champion = getTournamentChampion(brackets, tournamentType);

  // Determine if user can report a match result
  const canReportMatch = (match: Match): boolean => {
    // If no onReportMatch function is provided, we can't report
    if (!onReportMatch) {
      return false;
    }

    // Don't allow reporting for completed matches
    if (match.status === 'completed') {
      return false;
    }

    // Check if both players are assigned to the match
    if (!match.player1 || !match.player2) {
      return false;
    }

    // Allow reporting for pending matches with both players assigned
    return true;

    // Note: In a production environment, you would want to add restrictions
    // based on user roles (admin/creator/player) here
  };

  return (
    <div className="tournament-bracket-view">
      {isComplete && champion && (
        <div className="mb-6 p-4 bg-gradient-to-r from-cyber-primary to-cyber-secondary text-white rounded-md text-center">
          <h3 className="text-xl font-bold mb-2">Tournament Champion</h3>
          <div className="flex items-center justify-center">
            <div className="w-12 h-12 bg-cyber-bg-light rounded-full flex items-center justify-center mr-3 border-2 border-cyber-accent">
              <span className="text-xl">🏆</span>
            </div>
            <div>
              <p className="font-bold">{champion.name}</p>
              <p className="text-sm opacity-80">{champion.address.slice(0, 6)}...{champion.address.slice(-4)}</p>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <div className="min-w-[900px] pb-10">
          {/* Single Elimination or Winners Bracket */}
          <div className="mb-8">
            <h3 className="text-lg font-bold mb-4 text-cyber-primary">
              {tournamentType === 'single-elimination' ? 'Tournament Bracket' : 'Winners Bracket'}
            </h3>

            <div className="flex justify-between">
              {winnersBrackets.map((bracket, bracketIndex) => (
                <div key={`winners-${bracketIndex}`} className="flex-1 flex flex-col items-stretch space-y-8">
                  <h4 className="text-sm font-medium text-center text-cyber-text-secondary">
                    {bracketIndex === 0
                      ? 'Round 1'
                      : bracketIndex === winnersBrackets.length - 1
                      ? 'Finals'
                      : `Round ${bracketIndex + 1}`}
                  </h4>

                  <div className="flex flex-col space-y-16">
                    {bracket.matches.map((match, matchIndex) => (
                      <MatchCard
                        key={`winners-${bracket.round}-${match.id}-${match.position}-${matchIndex}`}
                        match={match}
                        onReportMatch={canReportMatch(match) ? () => onReportMatch?.(match) : undefined}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Double Elimination - Losers Bracket */}
          {tournamentType === 'double-elimination' && losersBrackets.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-4 text-cyber-secondary">Losers Bracket</h3>

              <div className="flex justify-between">
                {losersBrackets.map((bracket, bracketIndex) => (
                  <div key={`losers-${bracketIndex}`} className="flex-1 flex flex-col items-stretch space-y-8">
                    <h4 className="text-sm font-medium text-center text-cyber-text-secondary">
                      {`Round ${bracketIndex + 1}`}
                    </h4>

                    <div className="flex flex-col space-y-16">
                      {bracket.matches.map((match, matchIndex) => (
                        <MatchCard
                          key={`losers-${bracket.round}-${match.id}-${match.position}-${matchIndex}`}
                          match={match}
                          onReportMatch={canReportMatch(match) ? () => onReportMatch?.(match) : undefined}
                          isLosersBracket
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Double Elimination - Finals */}
          {tournamentType === 'double-elimination' && finalsBrackets.length > 0 && (
            <div>
              <h3 className="text-lg font-bold mb-4 text-cyber-accent">Finals</h3>

              <div className="flex justify-center">
                <div className="w-1/2">
                  {finalsBrackets[0].matches.map((match, matchIndex) => (
                    <div key={`finals-container-${match.id}-${matchIndex}`} className="mb-8">
                      <h4 className="text-sm font-medium text-center text-cyber-text-secondary mb-2">
                        {match.matchType === 'finals' ? 'Finals' : 'Grand Finals'}
                      </h4>
                      <MatchCard
                        key={`finals-${match.matchType || 'normal'}-${match.id}-${match.position}-${matchIndex}`}
                        match={match}
                        onReportMatch={canReportMatch(match) ? () => onReportMatch?.(match) : undefined}
                        isFinals
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface MatchCardProps {
  match: Match;
  onReportMatch?: () => void;
  isLosersBracket?: boolean;
  isFinals?: boolean;
}

function MatchCard({ match, onReportMatch, isLosersBracket = false, isFinals = false }: MatchCardProps) {
  // Determine card styling based on bracket type
  const getBorderColor = () => {
    if (isFinals) return 'border-cyber-accent';
    if (isLosersBracket) return 'border-cyber-secondary';
    return 'border-cyber-primary';
  };

  const getGlowEffect = () => {
    if (match.status === 'completed') {
      if (isFinals) return 'shadow-[0_0_10px_rgba(255,204,0,0.5)]';
      if (isLosersBracket) return 'shadow-[0_0_10px_rgba(255,0,160,0.3)]';
      return 'shadow-[0_0_10px_rgba(0,240,255,0.3)]';
    }
    return '';
  };

  return (
    <div
      className={`match border ${getBorderColor()} rounded-md p-3 relative h-[120px] bg-cyber-bg-light ${getGlowEffect()} transition-all duration-300 mb-8`}
    >
      <div className="flex flex-col space-y-2">
        <div
          className={`flex justify-between items-center p-2 rounded-md ${
            match.winner?.address === match.player1?.address
              ? 'bg-gradient-to-r from-cyber-bg-medium to-cyber-primary bg-opacity-20'
              : 'bg-cyber-bg-medium'
          }`}
        >
          <span className={match.winner?.address === match.player1?.address ? 'font-bold text-cyber-primary' : 'text-cyber-text-primary'}>
            {match.player1 ? match.player1.name : 'TBD'}
          </span>
          {match.winner?.address === match.player1?.address && (
            <span className="bg-cyber-primary text-cyber-bg-dark text-xs px-2 py-1 rounded">Winner</span>
          )}
        </div>

        <div
          className={`flex justify-between items-center p-2 rounded-md ${
            match.winner?.address === match.player2?.address
              ? 'bg-gradient-to-r from-cyber-bg-medium to-cyber-primary bg-opacity-20'
              : 'bg-cyber-bg-medium'
          }`}
        >
          <span className={match.winner?.address === match.player2?.address ? 'font-bold text-cyber-primary' : 'text-cyber-text-primary'}>
            {match.player2 ? match.player2.name : 'TBD'}
          </span>
          {match.winner?.address === match.player2?.address && (
            <span className="bg-cyber-primary text-cyber-bg-dark text-xs px-2 py-1 rounded">Winner</span>
          )}
        </div>
      </div>

      {/* Show the button if onReportMatch is provided and match is pending */}
      {onReportMatch && match.status === 'pending' && (
        <button
          className="report-result-btn bg-white border-2 border-cyber-primary text-cyber-bg-dark px-3 py-1 rounded"
          onClick={onReportMatch}
          style={{
            position: 'absolute',
            bottom: '-30px',
            right: '10px',
            zIndex: 50,
            padding: '8px 12px',
            boxShadow: '0 0 10px rgba(255, 255, 255, 0.7)',
            fontWeight: 'bold',
            color: '#000000'
          }}
        >
          REPORT RESULT
        </button>
      )}

      {match.status === 'disputed' && (
        <div className="absolute top-[-10px] right-[-10px] bg-red-500 text-white text-xs px-2 py-1 rounded-full">
          Disputed
        </div>
      )}
    </div>
  );
}
