SiyaSpotify — README

Overview

This is a small Node.js Express app that shows how to authenticate with Spotify using OAuth. The app serves static HTML pages and exposes /login and /callback routes for the Spotify OAuth flow.

Target reader: A-level student (simple steps)

Prerequisites

- Node.js (v16+ recommended) installed on your computer
- A Spotify developer account (to get Client ID and Client Secret)

Quick setup (Windows / PowerShell)

1. Open a terminal in the project folder (SiyaSpotify):

   cd C:\Users\<you>\Source\Repos\SiyaSpotify\SiyaSpotify

2. Install dependencies:

   npm install

3. Create a .env file from the template and fill in your Spotify credentials:

   Copy the example file:
   - PowerShell: Copy-Item .env.example .env
   - Git Bash / macOS / Linux: cp .env.example .env

   Then open .env in a text editor and replace the placeholder values with the real values you get from the Spotify Developer Dashboard.

Environment variables used

- CLIENT_ID — Spotify Client ID
- CLIENT_SECRET — Spotify Client Secret
- REDIRECT_URI — The redirect URI you registered in the Spotify app (example: https://localhost:3000/callback)

Important: Do NOT commit the .env file to Git. This project already includes a .gitignore that excludes .env. Keep your secrets private.

How to register a Spotify app (brief)

1. Go to https://developer.spotify.com/dashboard/
2. Log in with your Spotify account
3. Create a new app and copy the Client ID and Client Secret into your .env
4. In the app settings add the Redirect URI you will use (e.g. https://localhost:3000/callback)

Run the app

- Start the server:
  npm start

- Open http://localhost:3000/ in your browser. Click the /login link (or visit http://localhost:3000/login) to start the Spotify OAuth flow.

Notes and troubleshooting

- If you get an error about missing client configuration, open .env and make sure CLIENT_ID and CLIENT_SECRET are set.
- If Spotify rejects your redirect, double-check the Redirect URI in the Spotify dashboard matches REDIRECT_URI in your .env exactly (including scheme and port).
- If you need to remove Pug fully from node_modules, run:
  npm uninstall pug

Files of interest

- routes/auth.js — reads CLIENT_ID, CLIENT_SECRET, REDIRECT_URI from process.env and implements /login and /callback
- public/index.html — home page
- public/error.html — static error page
- .env.example — template for your environment variables

If you'd like, I can also:
- Add a more detailed walkthrough (screenshots) for registering the Spotify app
- Make the home page show whether you're authenticated and show returned tokens

