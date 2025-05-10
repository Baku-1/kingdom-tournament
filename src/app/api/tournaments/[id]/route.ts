import { NextRequest, NextResponse } from 'next/server';
import { mongoTournamentService } from '@/services/MongoTournamentService';

/**
 * GET /api/tournaments/[id]
 * Returns a specific tournament by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Await params to fix the Next.js warning
    const { id: tournamentId } = await Promise.resolve(params);

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
    console.error(`Error in GET /api/tournaments/${params.id}:`, error);
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
  { params }: { params: { id: string } }
) {
  try {
    const tournamentId = params.id;
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
    console.error(`Error in POST /api/tournaments/${params.id}:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to register for tournament' },
      { status: 500 }
    );
  }
}
