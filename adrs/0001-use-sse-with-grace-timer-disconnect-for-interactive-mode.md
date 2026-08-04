# 0001. Use Server-Sent Events with a grace-timer disconnect for interactive mode

Date: 2026-07-01
Status: Accepted

## Context

Interactive mode (`--interactive`) keeps the CLI's server running across
multiple review rounds while an AI agent revises the plan file on disk. The
browser tab needs to reflect those revisions without the user reloading, and
the CLI needs to know when the review session is genuinely over — e.g. when
the user closes the tab for good — so it can print a final status and exit,
rather than hanging forever.

The server is deliberately built on raw `node:http` (no Express — see
AGENTS.md) to avoid CJS/ESM bundling conflicts, so any transport choice had to
work with that constraint rather than lean on framework middleware.

Client-to-server communication (the verdict and comments) already existed via
`POST /submit`. What was missing was a server-to-client push channel for
plan/annotation updates, plus a way to detect "the browser is gone" that
tolerates ordinary hiccups (a page reload, a laptop waking from sleep)
without ending the session.

## Decision

Push updates over a one-way SSE stream (`GET /events`), broadcasting
`PlanUpdatePayload` JSON to every connected response whenever the CLI's
debounced file watcher fires. Connections are tracked in a `Set<ServerResponse>`.

Session-end detection is a grace timer, not an instant disconnect: when the
last SSE connection closes, a timer (`disconnectGraceMs`, instance-configurable,
default 30s) starts; if a new `/events` connection arrives before it fires
(e.g. the same tab reloading), the timer is cancelled. Only if the grace
period elapses with zero connected clients does the server invoke
`onSessionEnd`, which the CLI uses to print `=== SESSION CLOSED: client
disconnected ===` and exit non-zero.

## Alternatives Considered

- **WebSockets** — would add a second, bidirectional channel duplicating what
  `POST /submit` already does for client→server messages, and raw `node:http`
  has no built-in upgrade handling, so this would mean hand-rolling the
  WebSocket handshake or adding a dependency — not justified for a one-way
  push need.
- **Client polling** (`setInterval` re-fetching `GET /plan`) — simpler to
  implement, but trades away immediacy (updates only as fresh as the poll
  interval) for no real benefit, and gives no natural signal for "the browser
  closed" the way a dropped connection does — that would need a separate
  heartbeat mechanism.
- **Long-polling** — comparable latency characteristics to SSE but more
  complex to implement correctly (managing held-open requests, timeouts,
  re-request logic) for no benefit over SSE, which gets automatic
  reconnection for free from the browser's native `EventSource`.
- **Instant session end on disconnect** (no grace timer) — simplest option,
  but a page reload or brief network blip would prematurely kill the whole
  review session, forcing the agent to restart the CLI against the same file
  — defeating the point of keeping a session alive across rounds.

## Consequences

Easier: no bidirectional protocol or framework dependency to manage; the
browser's native `EventSource` reconnection logic is reused for free; the
server's job is just tracking a `Set` of open responses and writing to them.

Harder: two transports now exist side by side (SSE for push, HTTP POST for
submit) rather than one unified channel, so the contract has two shapes to
keep in sync (documented in AGENTS.md's Server contract section). Disconnect
detection is inherently fuzzy — a genuine client crash and a slow reconnect
are indistinguishable within the grace window, and the 30s default is a
judgment call rather than a value derived from measurement.

Accepted trade-off: false positives (ending a session on an unusually slow
reconnect) are rare enough in practice not to warrant more sophisticated
heartbeat/liveness logic.
