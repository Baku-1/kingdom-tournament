describe('Tournament Platform E2E Tests', () => {
  beforeEach(() => {
    // Visit the home page before each test
    cy.visit('/');
    
    // Mock the wallet connection
    cy.window().then((win) => {
      win.mockWalletConnection = {
        address: '0x1234567890123456789012345678901234567890',
        chainId: '2020',
        isConnected: true
      };
    });
  });

  it('should display the homepage with tournament list', () => {
    cy.get('h1').should('contain', 'Kingdom Tournament');
    cy.get('.tournament-list').should('exist');
  });

  it('should navigate to tournament creation page', () => {
    cy.get('a').contains('Create Tournament').click();
    cy.url().should('include', '/tournaments/create');
    cy.get('h1').should('contain', 'Create Tournament');
  });

  it('should create a new tournament', () => {
    // Navigate to create tournament page
    cy.get('a').contains('Create Tournament').click();
    
    // Fill out the form
    cy.get('input[name="name"]').type('Test Tournament');
    cy.get('textarea[name="description"]').type('This is a test tournament');
    cy.get('select[name="game"]').select('Axie Infinity');
    cy.get('select[name="tournamentType"]').select('Single Elimination');
    
    // Set dates
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 2);
    const dayAfterStr = dayAfter.toISOString().split('T')[0];
    
    cy.get('input[name="registrationEndDate"]').type(tomorrowStr);
    cy.get('input[name="startDate"]').type(dayAfterStr);
    
    // Select reward type
    cy.get('input[type="radio"][value="token"]').check();
    
    // Select token and amount
    cy.get('select[name="selectedToken"]').select('RON');
    cy.get('input[name="tokenAmount"]').type('100');
    
    // Set reward distribution
    cy.get('input[name="rewardDistribution.first"]').clear().type('50');
    cy.get('input[name="rewardDistribution.second"]').clear().type('30');
    cy.get('input[name="rewardDistribution.third"]').clear().type('15');
    cy.get('input[name="rewardDistribution.fourth"]').clear().type('5');
    
    // Enable entry fee
    cy.get('input[name="hasEntryFee"]').check();
    cy.get('input[name="entryFeeAmount"]').type('10');
    
    // Submit the form
    cy.get('button[type="submit"]').click();
    
    // Should redirect to tournament detail page
    cy.url().should('include', '/tournaments/');
    cy.get('h1').should('contain', 'Test Tournament');
  });

  it('should register for a tournament', () => {
    // Navigate to a tournament detail page
    cy.visit('/tournaments/1');
    
    // Click register button
    cy.get('button').contains('Register').click();
    
    // Confirm registration
    cy.get('button').contains('Confirm').click();
    
    // Should show registered status
    cy.get('.registration-status').should('contain', 'Registered');
  });

  it('should generate brackets after registration ends', () => {
    // Navigate to a tournament in registration phase
    cy.visit('/tournaments/1');
    
    // Mock registration end time to be in the past
    cy.window().then((win) => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      win.mockRegistrationEndTime = yesterday;
    });
    
    // Trigger bracket generation
    cy.get('button').contains('Force Generate Brackets').click();
    
    // Should show brackets
    cy.get('.tournament-brackets').should('exist');
    cy.get('.match').should('have.length.at.least', 1);
  });

  it('should report match results', () => {
    // Navigate to an active tournament
    cy.visit('/tournaments/1');
    
    // Find a match and report result
    cy.get('.match').first().within(() => {
      cy.get('button').contains('Report Result').click();
    });
    
    // Select winner
    cy.get('.report-result-modal').within(() => {
      cy.get('input[type="radio"]').first().check();
      cy.get('button').contains('Submit').click();
    });
    
    // Should show updated match with winner
    cy.get('.match').first().should('contain', 'Winner');
  });

  it('should claim rewards after tournament ends', () => {
    // Navigate to a completed tournament
    cy.visit('/tournaments/1');
    
    // Mock tournament as completed with current user as winner
    cy.window().then((win) => {
      win.mockTournamentCompleted = true;
      win.mockIsWinner = true;
    });
    
    // Click claim reward button
    cy.get('button').contains('Claim Reward').click();
    
    // Confirm claim
    cy.get('button').contains('Confirm').click();
    
    // Should show claimed status
    cy.get('.reward-status').should('contain', 'Claimed');
  });
});
