<div align="center">

# clipbrain

**AI clipboard brain — everything you've ever copied, searchable by meaning.**

[简体中文](README.zh-CN.md) | English

> Global hotkey · local embeddings (optional) · zero native modules · data never leaves your machine

[![CI](https://github.com/zhengqiuyang/clipbrain/actions/workflows/ci.yml/badge.svg?style=flat-square)](https://github.com/zhengqiuyang/clipbrain/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
![Node](https://img.shields.io/badge/Node-18%2B-green?style=flat-square)
![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey?style=flat-square)

[Quick start](#quick-start) · [How it works](#how-it-works) · [Honesty](#honesty) · [Verification](#verification) · [Roadmap](#roadmap)

</div>

## You copy hundreds of times a day, then forget it all

An SSH command, an error message, a link, an OTP, half a sentence you were writing —
the moment you copy it you're sure you'll remember it; three days later it has sunk
into the bottomless clipboard.

clipbrain catches all of it. Press `Alt+Shift+V` and a dark panel drops down from the top of the screen:

```text
┌─ clip brain ─────────────────────── ↑↓ select · Enter copy ─┐
│ Search everything you've copied…                  [semantic] │
├──────────────────────────────────────────────────────────────┤
│ cmd  │ git rebase -i HEAD~3                     3 min ago    │
│ link │ https://github.com/zhengqiuyang          1 hour ago   │
│ code │ const brain = require('./brain')         2 hours ago  │
│ text │ a context window is what a model reads   yesterday    │
└──────────────────────────────────────────────────────────────┘
```

- **Seven content types, auto-classified** — command / link / code / JSON / color / OTP / text, with color-coded badges
- **Semantic search** — with [Ollama](https://ollama.com) installed it upgrades automatically: "that command about retries" becomes findable. Without it you get clean lexical search, and the badge in the panel's top-right corner always tells you which mode you're in
- **Keyboard-first** — ↑↓ to select, Enter to copy and dismiss, Esc to hide, Ctrl+P to pin, Ctrl+D to delete
- **Local-first** — history lives in two JSON files under userData; nothing is ever reported anywhere. The clipboard is the most sensitive place on your machine — it goes nowhere

<a id="quick-start"></a>
## Quick start

```bash
git clone https://github.com/zhengqiuyang/clipbrain
cd clipbrain
npm install
npm start
```

Press `Alt+Shift+V` to summon. Copy anything — it lands in the timeline within 800 ms.

Optional semantic search:

```bash
ollama pull nomic-embed-text
# restart clipbrain; the panel badge flips from [lexical] to [semantic]
```

<a id="how-it-works"></a>
## How it works

```text
clipboard ──800ms poll──▶ dedupe / promote ──▶ classifier (7 deterministic types)
                                                │
                                                ▼
                       JSON store (userData, debounced atomic writes)
                                                │
global hotkey ──▶ frameless panel ──▶ hybrid search ◀┘
                                 lexical 0.30 + cosine 0.70 (optional Ollama)
                                 └ no Ollama? pure lexical — still fully usable
```

Design stance: **embeddings are an enhancement, not a dependency**. When Ollama is
unavailable, capture, search, pin and delete all keep working — only the badge
flips from [semantic] back to [lexical].

<a id="honesty"></a>
## Honesty section

- **v1 captures text only.** Image/file clipboards are on the roadmap.
- **History is not encrypted.** It lives in userData on your machine, and process-level protection equals the OS user boundary; for disk encryption pair it with BitLocker/FileVault. A sensitive-window blacklist is on the roadmap.
- **Deterministic retrieval.** Same store, same query → same ranking — locked by tests.
- **No telemetry, no network calls home.** The only network call is to local Ollama, if you enabled it.

<a id="verification"></a>
## Verification

Every promise above has an automated check (`node --test`, 24 cases):

| Promise | Verified by |
|---|---|
| Classifier determinism | boundary cases per type: URL / color / command / code / JSON / OTP / text |
| Store dedupe & promotion | duplicate capture adds no entry; promoted to top |
| Pins survive eviction | hard capacity cap keeps pinned items first |
| Corrupt file doesn't crash | hand-written bad JSON → restart from empty |
| Unrelated entries stay out of results | pure recency never fabricates hits (a test caught this real bug) |
| Semantic neighbors are findable | zero-lexical-overlap vector neighbors rank above weak lexical hits |
| Retrieval determinism | same store, same query, same ranking |
| Full pipeline | `npm run smoke:pipeline`: capture → classify → persist → reload → Chinese-text query |
| Desktop shell | `npm run smoke`: Electron self-check loop, measured exit code 0 |

CI: ubuntu / windows / macOS × Node 20 / 22.

<a id="configuration"></a>
## Configuration

`userData/settings.json` (defaults apply when absent):

```json
{
  "hotkey": "Alt+Shift+V",
  "maxItems": 5000,
  "ollama": { "enabled": true, "host": "http://127.0.0.1:11434", "model": "nomic-embed-text" }
}
```

<a id="roadmap"></a>
## Roadmap

- [ ] Image/file clipboard (thumbnail + visual embeddings)
- [ ] Sensitive-window blacklist (pause capture inside password managers)
- [ ] Pin management view & tags
- [ ] Packaged releases (nsis/dmg/AppImage)

<a id="principles"></a>
## Design principles

1. **Embeddings are an enhancement, not a dependency** — without Ollama it is still a great clipboard machine.
2. **Zero native modules** — clone, `npm install`, `npm start`: three lines and it runs.
3. **Deterministic retrieval** — ranking you can test, reproduce, and trust.
4. **Data never leaves the machine** — the clipboard is the most sensitive place on it.

## License

[MIT](LICENSE)
