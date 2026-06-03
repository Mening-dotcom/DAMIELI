# damieli.com — CV Tailor

AI-powered CV tailoring for damieli.com. Paste a job description and get a tailored resume in English or Spanish.

## Setup

1. Open a terminal in the `hireme` folder.
2. Install dependencies:

```bash
npm install
```

3. Create a `.env.local` file in the `hireme` folder with your Anthropic API key:

```bash
ANTHROPIC_API_KEY=your-anthropic-api-key
```

4. Start the app locally:

```bash
npm run dev
```

5. Open the app in your browser at:

```bash
http://localhost:3000
```

> If the terminal shows only the script list, that means you ran `npm run` instead of `npm run dev`.

## Local development notes

- Run commands from inside the `hireme` folder, not the workspace root.
- `npm run` only lists scripts. Use `npm run dev` to launch the development server.
- If you build for production, also set `AUTH_SECRET` in `.env.local`:

```bash
ANTHROPIC_API_KEY=your-anthropic-api-key
AUTH_SECRET=some-long-random-secret
```

## How multiple users are managed

- Each signup creates a separate user record in the database.
- The app stores profile state and generated CV history per authenticated user.
- The `.data/damieli.json` file is only a fallback JSON database.
- If `better-sqlite3` is available, the app uses `.data/damieli.sqlite` instead, and `.data/damieli.json` may not show all active data.
- If only one account appears in `.data/damieli.json`, that means only one user has been created so far.

## How to use

- Fill in your profile with jobs, education, skills, certifications, and languages.
- Paste a job description or job URL.
- Generate a tailored CV.
- Choose between PDF and Word download.

## Notes

- The app is served from the `hireme` folder in this workspace.
- The correct local URL is `http://localhost:3000`.
- If the app does not start, make sure you are running commands from `hireme`, not the workspace root.

## Vercel deployment

- Connect the `hireme` folder repository to Vercel.
- Set the project name to `damieli` or `damieli.com`.
- Add the environment variables in Vercel:
  - `ANTHROPIC_API_KEY`
  - `AUTH_SECRET`
- Vercel will automatically build the app on every push to the connected branch.
