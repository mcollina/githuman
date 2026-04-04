# `githuman ask` redesign plan

## Status

The current implementation proved that a synchronous agent ↔ human handoff is valuable, but it also exposed a major UX problem:

- using todos as the control mechanism is wrong
- the human has to understand internal workflow details
- the UI is too generic for a handoff flow
- there is no obvious single action that says “give this back to the assistant”

This document replaces the earlier todo-driven plan.

---

## Product goal

`githuman ask` should feel like a first-class handoff between an assistant and a human reviewer.

Desired flow:

1. the assistant runs `githuman ask`
2. GitHuman opens a dedicated review/handoff page
3. the human reviews the changes and leaves feedback
4. the human clicks a clear primary action: **Continue assistant**
5. `githuman ask` exits and prints the feedback for the assistant

The completion signal must be explicit and built for this feature, not borrowed from todos.

---

## Core product decisions

## 1. `ask` must be a first-class object

Do **not** model ask sessions as todos.

Introduce a dedicated persisted entity, for example `ask_sessions`.

Suggested fields:

- `id`
- `repository_path`
- `review_id` nullable
- `message`
- `status`
  - `waiting_for_human`
  - `ready_for_agent`
  - `cancelled`
- `assistant_context` nullable
- `created_at`
- `updated_at`
- `completed_at` nullable

Optional later fields:

- `feedback_summary`
- `url_token` or access metadata if needed
- `agent_name` / `agent_id`

## 2. Completion must be explicit

The human should finish the handoff by clicking a primary UI button:

- **Continue assistant**

Optional secondary button:

- `Cancel request`

This button should update the ask session status to `ready_for_agent`.

That status change is the only completion signal `githuman ask` should wait on.

## 3. Todos remain useful, but not for control flow

Todos can still exist as review artifacts.

They may be part of the feedback returned to the assistant, but they must not be used to:

- represent the ask session itself
- determine whether the human is done
- force the human to understand internal mechanics

---

## UX requirements

## Dedicated ask page

`githuman ask` should send the human to a focused page, not a generic dashboard.

Example routes:

- `/ask/:id`
- or `/handoff/:id`

This page should be massively simpler than the normal review UI.

### Page goals

The page should answer three questions immediately:

1. What is the assistant asking for?
2. Where should I leave feedback?
3. How do I hand this back to the assistant?

### Page content

Recommended layout:

- title: `Assistant review request`
- assistant message
- review context
  - linked review, if available
  - repository / branch context
- concise instructions
- current feedback state
  - comments count
  - unresolved comments count
  - todos count
- large sticky primary button:
  - **Continue assistant**
- smaller secondary button:
  - `Cancel request`

### Interaction model

The human should be able to:

1. inspect the review
2. leave comments
3. add todos if useful
4. click **Continue assistant**

No hidden rules.
No “mark this special todo as done.”
No generic workflow leakage.

---

## CLI behavior

## Command flow

```bash
githuman ask "Please review the parser refactor"
```

Behavior:

1. resolve config like `serve`
2. reuse a running GitHuman server if available, otherwise start one
3. create an ask session
4. print the dedicated ask URL
5. optionally open the browser
6. wait for ask session status to become `ready_for_agent` or `cancelled`
7. collect feedback from the session
8. print plain text or JSON output for the assistant

## Suggested output

Plain text:

```text
GitHuman feedback ready
URL: https://host:port/ask/123
Ask status: ready_for_agent
Review status: changes_requested

Todos:
- Add a regression test for whitespace-only input

Comments:
- src/parser.ts:42
  "Please reject undefined explicitly."
```

JSON:

```json
{
  "url": "https://host:port/ask/123",
  "askStatus": "ready_for_agent",
  "reviewStatus": "changes_requested",
  "todos": [],
  "comments": []
}
```

---

## Feedback semantics

When `githuman ask` completes, it should return feedback created during that ask session.

Recommended scope:

- comments created or updated after ask session start
- todos created or updated after ask session start
- review status at completion time
- optionally unresolved comments for the targeted review

If the ask session is tied to a review, filter primarily by that review.

---

## Config behavior

Keep the new config work.

Use repo-local config:

- `.githuman/config.json`

Supported defaults:

- `host`
- `port`
- `https`
- `open`
- `authToken`

Precedence:

1. CLI flags
2. `.githuman/config.json`
3. built-in defaults

This part of the implementation is still valid and should remain.

---

## Backend/API changes

## New persistence

Add an `ask_sessions` table.

Suggested migration:

- create table
- add indexes for `status`, `review_id`, `repository_path`, `created_at`

## Repository/service layer

Add:

- `AskSessionRepository`
- `AskSessionService`

Capabilities:

- create ask session
- fetch ask session by ID
- list ask sessions if needed
- mark as ready for agent
- cancel ask session
- compute session feedback summary

## API routes

Add endpoints such as:

- `POST /api/asks`
- `GET /api/asks/:id`
- `PATCH /api/asks/:id`
- `POST /api/asks/:id/continue`
- `POST /api/asks/:id/cancel`
- optional `GET /api/asks/:id/feedback`

This makes the flow explicit and testable.

---

## Frontend changes

## New ask page

Add a dedicated page and route for the ask handoff.

Likely additions:

- `src/web/pages/AskPage.tsx`
- route in `src/web/App.tsx`
- API client methods in `src/web/api/...`
- hooks for ask session loading and completion

## Simplified UI requirements

The ask page should:

- prioritize the assistant message
- make the next action obvious
- reduce navigation noise
- prominently show the **Continue assistant** button

The page may link into the full review UI, but the handoff page itself must stay simple.

## Continue button behavior

Clicking **Continue assistant** should:

- update ask session status to `ready_for_agent`
- optionally confirm the action
- show immediate success state
- allow `githuman ask` to exit

---

## Documentation updates

This is still a flagship feature and needs docs alongside implementation.

## README

Update README to describe the new first-class handoff flow:

- `githuman ask` creates a dedicated assistant review request
- the human completes the handoff with **Continue assistant**
- the feature is distinct from todos
- config file usage and precedence

## CLI docs

Document:

- `githuman ask` options
- server reuse/start behavior
- JSON output
- cancellation behavior

## Explanation docs

Add a short explanation of why this feature exists:

- AI agents need a clean human checkpoint
- GitHuman provides a true human-in-the-loop handoff
- the assistant resumes only when the human explicitly returns control

---

## Website updates

The website should highlight this redesigned flow, not the old todo workaround.

Messaging should emphasize:

- assistant asks for review
- human reviews in a focused UI
- human clicks **Continue assistant**
- assistant resumes with structured feedback

Recommended updates:

- hero/feature callout for `githuman ask`
- simple visual 3- or 4-step flow
- screenshot of the simplified ask page
- terminal example showing `githuman ask`

---

## Testing plan

## Backend tests

Add tests for:

- ask session creation
- status transitions
- continue/cancel actions
- feedback collection semantics

## CLI tests

Add tests for:

- creating an ask session
- waiting for `ready_for_agent`
- handling `cancelled`
- JSON output
- config precedence
- server reuse vs startup

## Frontend tests

Add tests for:

- ask page rendering
- Continue button visibility
- Continue button action
- cancellation flow
- simplified page state

## E2E tests

Add Playwright coverage for:

1. run `githuman ask`
2. open ask page
3. leave comment(s)
4. click **Continue assistant**
5. assert CLI exits with collected feedback

---

## Delivery plan

## Phase 1 — Preserve useful infrastructure

Keep and refine:

- shared config loading
- serve/ask runtime sharing
- CLI output formatting
- docs/website momentum

## Phase 2 — Introduce first-class ask sessions

- add DB migration
- add repository/service/routes
- update CLI to use ask sessions instead of todos

## Phase 3 — Build the dedicated ask page

- add new route and page
- simplify UI aggressively
- add **Continue assistant** button

## Phase 4 — Wire completion and feedback

- CLI waits for ask session status
- collect scoped feedback
- finalize text and JSON output

## Phase 5 — Docs and website

- update README
- update CLI docs
- update landing page
- add screenshot/demo assets

---

## Non-goals for v1 of the redesign

Avoid these until the core flow feels right:

- overly smart automation for detecting completion
- making todos mandatory
- embedding too much general review UI into the ask page
- multi-agent orchestration

The first priority is a simple, obvious, trustworthy handoff.

---

## Acceptance criteria

This redesign is successful when:

- `githuman ask` no longer depends on todos for completion
- the human sees a dedicated, simplified handoff page
- there is a clear **Continue assistant** button
- the assistant reliably resumes with structured feedback
- the flow is understandable without explanation

If a first-time user can complete the handoff without being told about implementation details, the redesign worked.
