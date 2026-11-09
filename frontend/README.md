# Frontend (commented)

Every code file has a comment on each line. `package.json` is plain JSON and cannot hold comments, so:

- Scripts: `dev` = development server, `build` = production build, `start` = serve the build.
- Dependencies: `next` (framework), `react` and `react-dom` (UI).
- Dev dependencies: `typescript` and type definitions for Node and React.

## Run
```
cp .env.example .env.local   # sets NEXT_PUBLIC_API_URL (the backend address)
npm i
npm run dev                  # http://localhost:3000
```
The backend must be running at the address in `.env.local`.
