const { spawn } = require('child_process');
const ngrok = require('ngrok');

// Start Next.js development server
const nextDev = spawn('npm', ['run', 'dev'], { 
  stdio: 'inherit',
  shell: true
});

console.log('Starting Next.js development server...');

// Give the Next.js server some time to start up
setTimeout(async () => {
  try {
    // Start ngrok tunnel pointing to port 3000
    const url = await ngrok.connect({
      addr: 3000,
      onStatusChange: status => {
        console.log(`Ngrok Status: ${status}`);
      },
      onLogEvent: data => {
        console.log(`Ngrok Log: ${data}`);
      }
    });
    
    console.log(`
    ✅ Ngrok tunnel is active!
    
    🌐 Public URL: ${url}
    
    Share this URL with your client to show your progress.
    Press Ctrl+C to stop both servers.
    `);
  } catch (error) {
    console.error('Error starting ngrok:', error);
    process.exit(1);
  }
}, 5000); // Wait 5 seconds for Next.js to start

// Handle process termination
process.on('SIGINT', async () => {
  console.log('Shutting down servers...');
  
  // Close ngrok tunnel
  await ngrok.kill();
  
  // Kill Next.js process
  nextDev.kill();
  
  process.exit(0);
});
