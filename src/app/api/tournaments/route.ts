import { NextRequest, NextResponse } from 'next/server';
import { mongoTournamentService } from '@/services/MongoTournamentService';

/**
 * POST /api/tournaments
 * Creates a new tournament
 */
export async function POST(request: NextRequest) {
  try {
    const tournamentData = await request.json();

    // Validate required fields
    if (!tournamentData.name || !tournamentData.gameId || !tournamentData.startDate || !tournamentData.registrationEndDate) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create the tournament
    const tournamentId = await mongoTournamentService.createTournament(tournamentData);

    return NextResponse.json({
      success: true,
      tournamentId,
      message: 'Tournament created successfully'
    });
  } catch (error) {
    console.error('Error in POST /api/tournaments:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create tournament' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/tournaments
 * Returns all tournaments
 */
export async function GET() {
  try {
    const tournaments = await mongoTournamentService.getAllTournaments();
    return NextResponse.json(tournaments);
  } catch (error) {
    console.error('Error in GET /api/tournaments:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get tournaments' },
      { status: 500 }
    );
  }
}
