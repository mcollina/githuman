# `githuman ask` plan

## Goal

Turn `githuman ask` into a synchronous handoff command for agent ↔ human collaboration:

1. The agent runs `githuman ask`.
2. GitHuman makes the review UI available and prints the URL, optionally opening the browser.
3. The human reviews the changes and leaves feedback in GitHuman.
4. When the human signals they are done, `githuman ask` exits by printing the human's feedback:
   - todo items
   - review comments
   - review status changes
5. The agent reads that output and applies fixes.
6. The feature ships with clear documentation and website updates so people immediately understand why it is useful and how to use it.

This is intentionally different from the current "create one todo and exit" behavior.

---

## Proposed UX

### Basic flow

```bash
githuman ask
```

Behavior:

- start GitHuman if needed, using serve-like options
- print the review URL
- optionally open the browser
- wait until the human marks the review request as complete
- print a structured summary of the human feedback
- exit with success

### With a prompt for the human

```bash
githuman ask "Please review the parser refactor"
```

This creates a visible review-request marker in GitHuman so the human knows what the agent is asking for.

### With explicit network settings

```bash
githuman ask --host 0.0.0.0 --port 4000 --open
```

Options should closely match `githuman serve`.

---

## Proposed completion signal

The command needs a concrete way to know when the human is done.

### Recommended approach

Use a dedicated request todo created by `githuman ask`.

Example content:

- `AI review request: Please review the parser refactor`
- `AI review request: Please review the current changes`

The human completes their turn by marking that todo as done in the UI.

### Why this is the best initial design

- no new database schema is required
- no new UI concept is required to ship v1
- works with the existing todo system
- gives the CLI an unambiguous "done" signal
- keeps the review loop explicit for both human and agent

### Optional future improvement

Later we can add a dedicated UI button like:

- `Finish human review`
- `Send feedback back to agent`

That would be cleaner, but it requires a new UI/backend concept.

---

## What `githuman ask` should do

### 1. Resolve runtime config

Load settings in this priority order:

1. CLI flags
2. config file
3. existing defaults

Relevant settings:

- `host`
- `port`
- `https`
- `auth`
- `open`

### 2. Ensure GitHuman is available

Two possible strategies:

#### Option A: start an in-process server from `ask`

Pros:
- one command does everything
- simple user experience

Cons:
- `ask` becomes responsible for lifecycle management
- more care needed for shutdown and polling

#### Option B: connect to an already-running server, otherwise start one

Pros:
- nicer if the user already has GitHuman open
- reuses existing running session

Cons:
- slightly more branching in the logic

### Recommendation

Implement **Option B**:

1. check `GET /api/health`
2. if reachable, reuse it
3. otherwise start a local server with the resolved config

---

## URL behavior

`githuman ask` should always print the URL to stdout/stderr in a copyable form.

Examples:

- `http://localhost:3847`
- `https://192.168.1.10:3847?token=...`

If `--open` is enabled, also open the browser.

Default behavior should match `serve` semantics as closely as possible.

---

## Config file

## Goal

Avoid forcing the agent/user to pass `--host` and `--port` every time.

### Proposed file location

Repository-local:

- `.githuman/config.json`

This keeps the settings next to the repository's GitHuman data.

### Example

```json
{
  "host": "localhost",
  "port": 3847,
  "https": false,
  "open": true
}
```

### Why repo-local first

- matches the existing `.githuman/` data model
- works well for dogfooding inside one repository
- easy for agents to discover
- avoids surprising machine-global behavior

### Future extension

If needed later, support both:

1. `~/.githuman/config.json`
2. `.githuman/config.json`

with repo-local taking precedence.

### Required behavior

- `serve` should also read the config file
- `ask` should reuse the same config loader
- CLI flags always override config file values

---

## Documentation and website changes

This feature is important enough that it should ship with a documentation and marketing pass, not just code.

### Product story to communicate

`githuman ask` is the handoff point between an LLM and a human reviewer:

1. the agent asks for review
2. GitHuman opens a human-friendly review surface
3. the human leaves comments and todos
4. the command returns those comments to the agent
5. the agent fixes the issues

That loop is the headline. It is novel, useful, and easy to demo.

### Documentation updates

We should update at least:

- `README.md`
- CLI help output examples where relevant
- any docs page that explains the review workflow
- release notes / changelog entry if we keep one

### README changes

The README should include:

- a short feature callout near the top
- a concrete `githuman ask` example
- a short explanation of the human-in-the-loop flow
- the new config file location and example
- how completion works in v1 (mark the request todo as done)

### CLI reference changes

Document:

- `githuman ask` options
- config precedence
- how `ask` differs from `serve`
- JSON output mode for agent integrations

### Workflow docs changes

Add or update a how-to guide covering:

- how to ask a human for review from an agent session
- how the human finishes their turn
- how the agent resumes from the printed feedback

Also add an explanation page or README subsection covering:

- why `githuman ask` exists
- why the request todo is used as the completion signal in v1
- how this creates a tight human ↔ agent review loop

### Website changes

The website should treat this as a flagship feature.

Recommended changes:

- add a hero or feature section for `githuman ask`
- explain the "agent asks → human reviews → agent resumes" loop visually
- include a terminal example showing `githuman ask`
- include one short UI screenshot of the review experience
- add a concise "why this matters" explanation for teams using AI coding agents

### Screenshots and demo assets

Because this is a very visual feature, we should refresh screenshots after implementation.

At minimum:

- capture a screenshot showing the request todo / review workflow
- update README screenshots if the feature is shown there
- update website assets if the landing page references the new flow

If needed, refresh screenshots with:

```bash
node scripts/screenshots.ts
```

### Messaging guidance

The tone should frame this feature as:

- human-in-the-loop review for AI coding agents
- a simple bridge between coding agents and human reviewers
- a workflow feature, not just another CLI command

---

## Feedback collected at the end

When the human completes the request, `githuman ask` should print:

1. the request todo status
2. all current pending todos relevant to the review session
3. all comments added by the human during the session
4. the latest review status

### Recommended output shape

Plain text, optimized for agent consumption:

```text
GitHuman feedback ready
URL: http://localhost:3847
Review status: changes_requested

Todos:
- Fix null handling in parser.ts
- Add a test for empty input

Comments:
- src/parser.ts:42
  "This should reject undefined explicitly."
- src/parser.test.ts
  "Please add a regression test for whitespace-only input."
```

### Important detail

The command should only print **new feedback from this ask session**, not old historical comments.

That means `ask` must record a session start timestamp and filter by:

- todos created or updated after the session start
- comments created or updated after the session start

Potentially also filter by review ID when available.

---

## Review targeting

`githuman ask` needs to know what the human is reviewing.

### v1 recommendation

Operate on the current repository/session and do not force a review ID.

Behavior:

- if there is an active in-progress review, reuse it
- otherwise open the GitHuman UI and let the human inspect staged changes or create/select the right review

### Better v1.1

Support optional targeting:

```bash
githuman ask --review <id>
```

If `--review` is provided, the end-of-command output should scope comments/todos to that review when possible.

---

## Polling / waiting model

`githuman ask` should wait until the request todo is completed.

### Polling loop

Every 1-2 seconds:

- fetch the ask todo by ID
- if completed, gather feedback and exit
- if deleted, treat as cancelled
- if server disappears, show a clear error

### Nice-to-have later

Use SSE/events for lower-latency updates instead of polling.

For v1, polling is simpler and good enough.

---

## Cancellation behavior

### Human cancellation

If the request todo is deleted, exit non-zero with:

- `Review request was cancelled`

### Agent cancellation

If the process is interrupted:

- stop any server that `ask` started itself
- leave the request todo in place
- print the URL again before exit if possible

---

## CLI options

`githuman ask` should support most of the `serve` options:

- `-p, --port <number>`
- `--host <string>`
- `--https`
- `--no-https`
- `--cert <path>`
- `--key <path>`
- `--auth [token]`
- `--open`
- `--no-open`
- `-v, --verbose`
- `-h, --help`

Additional ask-specific options:

- `--review <id>` — optional review to watch/scope
- `--interval <ms>` — optional polling interval
- `--json` — machine-readable final output

---

## JSON output mode

For agent integrations, `--json` is important.

Example:

```json
{
  "url": "http://localhost:3847",
  "reviewStatus": "changes_requested",
  "todos": [
    {
      "id": "...",
      "content": "Fix null handling in parser.ts",
      "reviewId": null
    }
  ],
  "comments": [
    {
      "id": "...",
      "reviewId": "...",
      "filePath": "src/parser.ts",
      "lineNumber": 42,
      "content": "This should reject undefined explicitly.",
      "resolved": false
    }
  ]
}
```

---

## Implementation checklist

## Milestone 1 — Shared config loading

### Code

- [ ] add a shared CLI config loader for `.githuman/config.json`
- [ ] support at least:
  - [ ] `host`
  - [ ] `port`
  - [ ] `https`
  - [ ] `open`
  - [ ] auth-related defaults where appropriate
- [ ] define precedence clearly:
  - [ ] CLI flags override config file values
  - [ ] config file values override built-in defaults
- [ ] update `githuman serve` to use the shared config loader
- [ ] keep existing env-var behavior working unless we intentionally replace it

### Acceptance criteria

- [ ] `githuman serve` works exactly as before when no config file exists
- [ ] `githuman serve` respects `.githuman/config.json`
- [ ] `--host` and `--port` no longer need to be passed every time when config is present

## Milestone 2 — Rework `githuman ask`

### Code

- [ ] remove the current fire-and-forget todo-creation behavior
- [ ] make `ask` resolve config using the same path as `serve`
- [ ] make `ask` try to connect to an existing server first
- [ ] if no server is running, start one with serve-like options
- [ ] print the final URL in a copyable form
- [ ] support browser opening with serve-like semantics
- [ ] create a dedicated request todo for the ask session
- [ ] store enough local session state to know:
  - [ ] the request todo ID
  - [ ] the session start time
  - [ ] whether `ask` started the server itself

### Acceptance criteria

- [ ] `githuman ask` can be run in a fresh repo with GitHuman configured
- [ ] the command shows the human where to review
- [ ] the human has a visible request marker in the UI

## Milestone 3 — Wait for human completion

### Code

- [ ] poll the request todo until it is completed
- [ ] treat deletion of the request todo as cancellation
- [ ] handle server unavailability with a clear error
- [ ] support configurable polling interval if we keep `--interval`

### Acceptance criteria

- [ ] `githuman ask` stays open while the human is reviewing
- [ ] `githuman ask` exits when the request todo is marked done
- [ ] `githuman ask` exits non-zero if the request todo is deleted

## Milestone 4 — Print human feedback for the agent

### Code

- [ ] record the session start timestamp before waiting
- [ ] collect feedback created or updated during the session:
  - [ ] todos
  - [ ] comments
  - [ ] review status
- [ ] scope by review ID when available
- [ ] print a plain-text summary for agent consumption
- [ ] add `--json` output mode

### Acceptance criteria

- [ ] the final output contains only feedback relevant to this ask session
- [ ] the output is useful enough for an agent to continue work without extra manual lookup
- [ ] JSON output is stable and machine-readable

## Milestone 5 — Polish and edge cases

### Code

- [ ] improve terminal messaging during startup and waiting
- [ ] handle Ctrl+C cleanly
- [ ] stop any server that `ask` started itself
- [ ] leave user-started servers untouched
- [ ] optionally support `--review <id>` in the initial implementation or clearly defer it
- [ ] decide whether SSE is out of scope for v1 and document that decision

### Acceptance criteria

- [ ] interruption behavior is predictable
- [ ] startup/wait/final-summary messages are easy to understand
- [ ] there is no ambiguity about whether the review request finished, was cancelled, or failed

## Milestone 6 — Documentation updates

### README

- [ ] add a feature callout for `githuman ask`
- [ ] add a concrete CLI example
- [ ] explain the human-in-the-loop flow
- [ ] document `.githuman/config.json`
- [ ] document the completion signal used in v1

### Reference / guides

- [ ] update CLI reference/help examples for `ask`
- [ ] add or update a workflow guide for the full agent ↔ human loop
- [ ] add or update explanatory docs for why `ask` exists and how it works
- [ ] add release notes / changelog entry if applicable

### Acceptance criteria

- [ ] a new user can understand `githuman ask` from the README alone
- [ ] a returning user can look up flags and config precedence quickly
- [ ] docs reflect the exact shipped behavior, not an idealized version

## Milestone 7 — Website updates

### Website content

- [ ] add `githuman ask` as a flagship feature on the landing page
- [ ] explain the `agent asks → human reviews → agent resumes` loop
- [ ] add a terminal snippet using `githuman ask`
- [ ] add a short explanation of why this matters for AI-assisted development

### Visuals

- [ ] capture or update screenshots for the ask flow
- [ ] refresh any demo assets used by the README or website
- [ ] ensure screenshots match the current UI

### Acceptance criteria

- [ ] the website makes the feature easy to understand in a few seconds
- [ ] the screenshots and copy match the shipped implementation
- [ ] the feature feels prominent, not buried

## Suggested delivery order

- [ ] ship Milestone 1 first
- [ ] ship Milestones 2 and 3 together
- [ ] ship Milestone 4 before calling the feature complete
- [ ] ship Milestones 6 and 7 in the same PR or release window as the code
- [ ] validate all examples and screenshots immediately before merge

---

## Backend/API needs

### Can be done with existing APIs

Mostly yes.

Existing endpoints already cover:

- health
- todos
- comments
- reviews

### Small additions that may help

Potential optional additions:

- `GET /api/todos/:id` is already available and useful for polling
- query filters by timestamp may be useful later, but are not required for v1
- a dedicated `ask session` API is not required for the first version

---

## Testing plan

### CLI tests

Add tests for:

- config file loading
- `ask --help`
- URL printing
- creating the request todo
- waiting until the request todo is completed
- final output includes new todos/comments
- `--json` output
- reuse running server vs start new server

### Integration tests

Add a test that:

1. starts the app
2. runs `githuman ask`
3. simulates the human by creating comments/todos and completing the ask todo
4. asserts the command exits with the expected summary

### Optional e2e test

A future Playwright test could validate the full handoff loop in the browser.

### Documentation / website validation

Before shipping, verify that:

- README examples match the real CLI output
- the documented config file format matches the implementation
- the website copy matches the final completion signal semantics
- screenshots reflect the actual UI and current branding

---

## Suggested first cut

To keep this shippable, the first implementation should:

- use `.githuman/config.json`
- make `serve` and `ask` share config loading
- have `ask` create a dedicated request todo
- treat "request todo marked done" as the completion signal
- poll with `GET /api/todos/:id`
- print new todos/comments since session start
- support `--json`
- update the README and website copy alongside the implementation

This gives us the full agent → human → agent loop without requiring a major UI redesign, while also making the feature easy to discover.
