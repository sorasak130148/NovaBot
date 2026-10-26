# NovaBot

A self-hosted web chat for a small team of Bots. Each Bot has its own name, color, blob avatar, instructions and
model, and every request goes through **your own API key** on any OpenAI-compatible endpoint
(OpenCode Go, xAI, local Ollama, ...). The UI is inspired by the Grok Bot mobile app.

## Run

```bash
cp .env.local.example .env.local   # fill in your key + endpoint
npm install
npm run dev                        # http://localhost:3000
```

## API key

Two ways to supply it:

1. **Server key**: `XAI_API_KEY` in `.env.local`. It never reaches the browser.
2. **Per-browser key**: Settings → API key. Stored in that browser's localStorage and sent to this app's own
   `/api/chat` on each request (`x-api-key` header). It overrides the server key.

| Variable | Meaning | Example |
|---|---|---|
| `XAI_API_KEY` | API key for the endpoint | `oc_sk_...`, `xai-...` |
| `XAI_BASE_URL` | OpenAI-compatible base URL | `https://opencode.ai/zen/go/v1` |
| `DEFAULT_MODEL` | Model used when a Bot is on "Default" | `deepseek-v4.1-flash` |

### OpenCode Go notes
- The key must come from the workspace that holds the active Go subscription, otherwise every call returns 403.
- NovaBot sends a stable `x-opencode-session` per conversation (a new one after "Reset") and identifies itself as
  `NovaBot/<version>`, as the OpenCode docs ask.
- Only models served over `/chat/completions` work. Tested: `deepseek-v4.1-flash`, `glm-5.3-flash`, `kimi-k3`,
  `qwen3.8-flash`. `grok-4.7` uses a different protocol and fails.
- OpenCode describes Go as built for coding agents and monitors traffic, so check their terms before heavy use.

## Deploy for other people (bring your own key)

1. Import this repo on [vercel.com/new](https://vercel.com/new). No build settings needed.
2. **Don't** set `XAI_API_KEY` there. Without a server key, every visitor is asked for their own key and picks a
   provider (OpenCode Go, OpenCode Zen, xAI, OpenRouter) in Settings. Nobody can spend your money.
3. Provider URLs are fixed in `lib/providers.ts`; visitors can't point the server at arbitrary URLs.

Keys pass through your server on each request (never logged or stored), so visitors have to trust whoever runs it.

## Features
- Bot list with search, a primary Bot, and Bots created from templates (Chief of Staff, Inbox Triage,
  Invoice Chaser, Researcher, Customer Support) or from scratch
- Per-Bot color, avatar character, instructions (system prompt) and model
- Model picker in the chat header to switch models at any time; each Bot remembers its choice
- Streaming replies (reasoning models included), markdown/GFM, stop and reset
- Bots and chats live in localStorage, no database
- Light/dark mode follows the system; on mobile the sidebar becomes a drawer

## Not included yet
Group chats, routines (scheduled runs), connectors/tools, approval rules, voice.

## Before deploying publicly
There is no login. Anyone who can open the URL can spend your server key, so add auth or rate limiting first.
