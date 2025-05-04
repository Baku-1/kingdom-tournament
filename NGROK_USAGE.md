# Sharing Your Kingdom Tournament Project with Ngrok

This guide explains how to use ngrok to share your local development server with clients or team members.

## What is Ngrok?

Ngrok is a tool that creates a secure tunnel to your localhost, making your local development server accessible over the internet. This is useful for:

- Sharing your work with clients
- Testing your application on different devices
- Demonstrating features without deploying

## Prerequisites

- You have already installed the project dependencies with `npm install`
- Your Next.js development server works locally

## Usage Options

### Option 1: Start Both Next.js and Ngrok Together (Recommended)

Run the following command:

```bash
npm run share
```

This will:
1. Start your Next.js development server on port 3000
2. Start ngrok and create a tunnel to that port
3. Display a public URL that you can share with others

### Option 2: Run Ngrok Separately

If you already have your Next.js server running in another terminal with `npm run dev`, you can start ngrok in a separate terminal:

```bash
npm run ngrok
```

## Important Notes

- The ngrok URL changes each time you restart the tunnel unless you have a paid ngrok account
- Anyone with the ngrok URL can access your local server while the tunnel is active
- Remember to stop the ngrok tunnel when you're done sharing (Ctrl+C)
- If you're using authentication or other sensitive features, be cautious about who you share the URL with

## Troubleshooting

If you encounter issues:

1. Make sure your Next.js server is running correctly on port 3000
2. Check that ngrok is installed correctly (`npm list ngrok`)
3. Try running ngrok directly with `npx ngrok http 3000`
4. If you get an "address in use" error, make sure you don't have another ngrok instance running
