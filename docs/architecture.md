# OctoFit Tracker architecture

OctoFit Tracker is a three-tier application for a school fitness program. The starter code includes API contracts and intentionally incomplete implementation points so you can use GitHub Copilot agent mode in a test-driven loop.

![Three-tier OctoFit architecture](../.github/images/octofit-architecture.svg)

## Tier boundaries

- **Presentation tier**: React 19, Vite, React Router, Bootstrap, and a shared API client in `octofit-tracker/frontend/src`.
- **Logic tier**: Express and TypeScript routes/services in `octofit-tracker/backend/src` expose `/api/*` behavior on port `8000`.
- **Data tier**: Mongoose models and seed data in `octofit-tracker/backend/src/models` and `src/scripts/seed.ts` persist to MongoDB on port `27017`.

## Ports and environment rules

- MongoDB: `27017`
- Express API: `8000`
- Vite frontend: `5173`
- The browser calls relative `/api` paths. Vite proxies them to `http://localhost:8000`, so the unauthenticated API port stays private in Codespaces. `VITE_API_BASE_URL` can override the base URL.

## API contract

| Capability | Method and path | Expected behavior |
| --- | --- | --- |
| Activity tracking | `GET /api/activities`, `POST /api/activities` | List and create valid activity records. POST accepts `userId`, `teamId`, `type`, and `minutes`; `userId` and `teamId` must be well-formed IDs for an existing user and team; otherwise respond with a deliberate 4xx (never a 500 from a cast error). A created activity stores the submitted `user`, `team`, `type`, and `minutes` plus computed `points` and `occurredAt`. |
| Teams | `GET /api/teams`, `POST /api/teams` | List and create teams with members. Created and listed teams keep the submitted `name` and `mascot`. Reject a team without a name with `400`. |
| Leaderboard | `GET /api/leaderboard` | Return teams ordered by the sum of their activity points, highest first. Each entry has `teamName`, `totalPoints`, and a 1-based `rank`. |
| Workout suggestions | `GET /api/workouts/suggestions/:userEmail` | Recommend workouts from recent activity patterns for the matching seeded user's email address. The first suggestion's `focus` matches that user's goal or recent activity, with a `reason` explaining why. An email with no matching user returns a deliberate 4xx (for example, `404`). |

## Implementation decisions

Record your plan here before editing code.

- Presentation tier decision: Keep React components responsible for routing and rendering only; use a shared API client for `/api` requests and centralize loading, empty, error, and response-shape handling in reusable UI behavior.
- Logic tier decision: Implement Express routes and small service helpers in `octofit-tracker/backend/src`; keep HTTP validation and status responses at the route boundary, with Mongoose operations and calculations in the logic tier.
- Data tier decision: Define and validate Mongoose models for users, teams, activities, and workouts in `octofit-tracker/backend/src/models`, then preserve idempotent seed behavior in `octofit-tracker/backend/src/scripts/seed.ts`.
- Activity tracking approach: Validate `userId`, `teamId`, activity type, and minutes before writes; verify both IDs exist and are castable, compute positive points, set `occurredAt`, and return deliberate 4xx responses for invalid references.
- Team management approach: Require a team name and mascot, default `members` to an empty array, accept existing member IDs, and expose members in created and listed team responses.
- Leaderboard approach: Aggregate activity points by team, sort totals from highest to lowest, assign a 1-based rank, and return `teamName`, `totalPoints`, and `rank`.
- Workout suggestions approach: Resolve the user's email, derive the primary recent activity pattern or fitness goal, filter or rank workout suggestions by matching focus, and include a reason in each recommendation; return a 4xx for an unknown email.

## Test plan

Record the commands you run and what each failure means.

- Data-tier command: `npm run test:data --prefix octofit-tracker/backend`
  - Run first. It checks Mongoose validation and idempotent seed behavior.
  - Baseline: 4 failures and 1 pass. Required User, Team, Activity, and Workout fields are missing or underconstrained; representative data seeding already passes.
- API command: `npm run test:api --prefix octofit-tracker/backend`
  - Run only after the data models pass. It checks activity and team API behavior, leaderboard aggregation, and workout suggestion matching.
  - Baseline: 4 failures. Activity/team routes return incomplete `501` responses, leaderboard data is empty, and workout suggestions do not match users correctly.
- Frontend command: `npm test --prefix octofit-tracker/frontend -- --run`
  - Run last, after the API contract passes. It checks route rendering, shared API requests, and accessible loading, empty, success, and failure states.
  - Baseline: 15 failures. The presentation tier does not yet satisfy activity, team, leaderboard, workout, loading, empty, or API-error behavior.
- Backend build command: `npm run build --prefix octofit-tracker/backend`
  - Run after API tests pass to verify Express and TypeScript compile successfully.
- Frontend build command: `npm run build --prefix octofit-tracker/frontend`
  - Run after frontend tests pass to verify React and Vite compile successfully.

## Incremental implementation order

1. Implement and verify data models, field validation, defaults, references, and seed behavior. Stop and run the data-tier tests before moving up.
2. Implement API behavior for activities and teams first, then leaderboard aggregation and workout suggestions. Run API tests after the route implementation is complete.
3. Implement frontend API access and route behavior last, then run frontend tests and both builds.
