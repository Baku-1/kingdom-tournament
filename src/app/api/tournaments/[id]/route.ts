import { NextRequest, NextResponse } from 'next/server';
import { mongoTournamentService } from '@/services/MongoTournamentService';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/tournaments/[id]
 * Returns a specific tournament by ID
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    // Get the tournament ID from params (now a Promise)
    const resolvedParams = await params;
    const tournamentId = resolvedParams.id;

    // Log the request for debugging
    console.log(`GET request for tournament ID: ${tournamentId}`);

    const tournament = await mongoTournamentService.getTournament(tournamentId);

    if (!tournament) {
      console.log(`Tournament with ID ${tournamentId} not found`);
      return NextResponse.json(
        { error: 'Tournament not found' },
        { status: 404 }
      );
    }

    console.log(`Successfully retrieved tournament: ${tournament.name}`);
    return NextResponse.json(tournament);
  } catch (error) {
    const resolvedParams = await params;
    console.error(`Error in GET /api/tournaments/${resolvedParams.id}:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get tournament' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tournaments/[id]
 * Registers a participant for a tournament
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    // Get the tournament ID from params (now a Promise)
    const resolvedParams = await params;
    const tournamentId = resolvedParams.id;

    const { address, name } = await request.json();

    if (!address) {
      return NextResponse.json(
        { error: 'Participant address is required' },
        { status: 400 }
      );
    }

    await mongoTournamentService.registerForTournament(tournamentId, {
      address,
      name: name || `Player ${Math.floor(Math.random() * 1000)}`
    });

    return NextResponse.json({
      success: true,
      message: 'Successfully registered for tournament'
    });
  } catch (error) {
    const resolvedParams = await params;
    console.error(`Error in POST /api/tournaments/${resolvedParams.id}:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to register for tournament' },
      { status: 500 }
    );
  }
}
