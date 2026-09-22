# AI Assistant API (proposed contract)

The Vue app's AI Assistant page (`/ai-assistant`) is built against this contract. It is **not
implemented in vendor-portal-api yet**. Until it is, the page shows "The AI assistant isn't
connected yet" and the agent catalogue from `src/constants/aiAgents.ts`.

For UI work without a backend, start the dev server with `VITE_AI_MOCK=true` (e.g. in a
git-ignored `.env.development.local`). Replies are canned and labelled `[Mock reply …]`.

Types: `src/schema/ai.ts`. Client: `src/services/api/ai/{agent,session}.ts`.

## Endpoints (`/api/v1`)

All endpoints are scoped to the current vendor (`X-Vendor-Id` today, the auth token later).
Errors use the existing flask-smorest shape `{ code, status, message, errors? }`.

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| GET | `/ai/agents` | — | `AiAgent[]` |
| GET | `/ai/sessions` | — | `AiSession[]`, most recently updated first |
| POST | `/ai/sessions` | `{ agentId, title?, context?: { invoiceId? } }` | `201 AiSession` |
| GET | `/ai/sessions/{id}` | — | `AiSessionDetail` (session + `messages`, oldest first) |
| PATCH | `/ai/sessions/{id}` | `{ title }` | `AiSession` |
| DELETE | `/ai/sessions/{id}` | — | `204` |
| POST | `/ai/sessions/{id}/messages` | `{ content }` (max 4000 chars) | `201 { userMessage, assistantMessage, session }` |

```jsonc
// AiAgent
{ "id": "status-tracker", "name": "Invoice Status Tracker", "description": "…",
  "icon": "bi-clock-history", "status": "available" | "preview",
  "capabilities": ["…"], "dataAccess": ["…"], "starterPrompts": ["…"] }

// AiSession
{ "id": "uuid", "agentId": "status-tracker", "title": "Where is INV-2026-0524?",
  "createdAt": "…Z", "updatedAt": "…Z", "messageCount": 4, "preview": "…" }

// AiMessage
{ "id": "uuid", "role": "user" | "assistant", "content": "plain text", "createdAt": "…Z",
  "citations": [{ "type": "invoice", "id": "<invoice uuid>", "label": "INV-2026-0524" }] }
```

- The app creates a session only when the vendor sends the first message, with the message as the
  title. Conversation state lives on the server; the browser keeps nothing between visits.
- `content` is rendered as plain text (no HTML). Invoice citations link to the Invoice Details page.
- The reply can take a while when the model uses tools; the client waits up to 90 seconds.
  Streaming (`text/event-stream`) can be added later without changing the stored shapes.
- Suggested status codes: `404` unknown session/agent, `409` preview agent not enabled for this
  vendor, `422` empty or too-long message, `429` rate limit, `503` model unavailable.

## Suggested backend (Claude on AWS Bedrock)

- **Model**: Claude Sonnet 5 through the Bedrock Converse API (`bedrock-runtime` `converse`),
  called with boto3 using the API's IAM role, the same way it already reaches S3. No API keys in
  the app.
- **Storage**: `ai_sessions` (id, vendor_id, agent_id, title, timestamps) and `ai_messages`
  (id, session_id, role, content, citations JSON, token counts, created_at) in PostgreSQL.
- **Agents** = a system prompt + a set of tools. Every tool is **read-only** and runs through the
  existing services with the current vendor, so an agent can never see another vendor's data or
  change anything:

| Agent | Tools |
| --- | --- |
| Invoice Submission Assistant | `get_reference_data`, `list_drafts`, `check_draft(invoice_id)` (runs `validation_errors`), `find_duplicate_invoice_no` |
| Invoice Status Tracker | `search_invoices(query, status, dates)`, `get_invoice`, `get_timeline`, `list_comments` |
| Document Compliance Checker | `list_documents(invoice_id)`, `get_extraction_text(extraction_id)`, `compare_amounts(invoice_id)` |
| Payment & Remittance Assistant | `list_invoices(status=Approved/Paid)`, `estimate_due_date(invoice_id)` (+ payment records when they exist) |
| Rejection & Discrepancy Resolver | `list_invoices(status=Rejected)`, `get_invoice`, `list_comments` — drafts replies as text only; posting stays a vendor action |
| AP Policy & Help Desk | `search_policies(query)` over AP guidelines (e.g. a Bedrock Knowledge Base) — no account data |

- **Guardrails**: a Bedrock Guardrail for prompt-injection and PII filtering, and treating
  document/OCR text as untrusted data (never as instructions) in the prompts.
- **Limits**: cap tool calls per turn, conversation length and requests per vendor per minute;
  log token usage per message for cost tracking.
