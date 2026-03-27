<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/d1adc113-3564-48b7-add1-b210b1566900

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Create `.env.local` and set:
   `GEMINI_API_KEY=your_key_here`
   `API_PORT=8787`
3. Run the API server in one terminal:
   `npm run dev:api`
4. Run the web app in a second terminal:
   `npm run dev`

The web app proxies `/api/*` requests to `http://localhost:8787` in development.
