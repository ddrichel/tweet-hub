# Tweet Hub

Your X posts as your own timeline on GitHub Pages. No X API, no server, no cost, no tokens.

## How it works

1. Post on X as usual.
2. Desktop: click the **Tweet Hub bookmarklet** on a post. Mobile: in the X app, **Share → Copy link**, open `add.html`, tap **Paste link and save**.
3. GitHub opens a prefilled issue → **Submit**.
4. A GitHub Action adds the post to `tweets.json`, closes the issue, and the post shows up in the timeline.

Only issues opened by the repo owner are accepted, so nobody else can add posts.

## Run your own in 2 minutes

1. **Fork** this repo (any name).
2. **Enable Actions** (forks: "Actions" tab → enable).
3. **Enable GitHub Pages:** Settings → Pages → branch `main`, folder `/ (root)`.
4. **Edit your profile** in `tweets.json` (name, handle, bio); leave `tweets` empty.
5. Open `https://<you>.github.io/<repo>/add.html` and drag the bookmarklet to your bookmarks bar.

Your avatar is taken from your GitHub profile automatically.

## Conversations and source coverage

The feed combines all recorded parent/child relationships into conversations, deduplicated by exact X IDs. Parents, self-replies and Grok answers remain visible together. All, Posts, Replies and Grok filters retain the full known context around matching entries; Copy conversation preserves authors, original text, dates, canonical links and reply references.

Posts means confirmed standalone own posts. Legacy entries with no recorded reply status remain explicitly unconfirmed; an absent parent field is not proof that an entry was a standalone post. Counts cover unique saved bodies, not duplicate nested appearances or the full X account.

`inReplyTo` remains a nested object and `replies` remains a recursive array. New captures can also provide `replyToId` and `replyStatus` (`post`, `reply`, `unknown`). Missing parent bodies stay visible as references. Differing body captures are retained in `captures`; the renderer keeps their exact text versions inspectable. Source completeness is confirmed only when supplied by the capture, such as a full archive entry. Unconfirmed completeness does not assert truncation.

Photos, animated GIFs and videos are retained as typed media, including original URLs, video variants, poster images, dimensions and alt text when supplied by the source. GIFs loop inline; ordinary videos have playback controls. Single images retain their complete aspect ratio so meme text is not cropped. Later captures add media to existing posts instead of hiding it behind an older empty media array.

Issue imports also try X's public embed payload for the known post ID. It preserves the exact raw source text and payload separately from the displayed text, with the capture time. Saved quote posts, link cards and polls remain available. If this public source is unavailable, the original capture is kept. Enrich existing saved IDs with `node scripts/hydrate-posts.js --pending`; this is not an exhaustive account sync.

The bookmarklet on a post page keeps visible own entries and Grok bodies. It records only explicit parent references and never guesses links from adjacent cards. Expand and load the intended public conversation before capture; off-screen/unloaded replies cannot be recovered by this script. Large captures download as complete JSON rather than being shortened to fit an issue URL:

```bash
node scripts/import-capture.js tweet-conversation-ID.json
```

Issue ingestion and archive imports enrich existing entries with newly captured relationships/replies instead of discarding that context. Original source fields and recursive arrays are preserved. Archive imports retain exact raw wording in `source.originalText` and record the displayed entity decoding separately.

Inspect the current coverage and unresolved canonical references:

```bash
node scripts/conversation-report.js
```

The mirror does not establish exhaustive X coverage or a live signed-in sync. Additional parent links and full bodies need an actual source capture.

## Import past posts

1. Request your archive: https://x.com/settings/download_your_data
2. Unzip it, then in the repo: `node scripts/import-archive.js <archive-folder>`
   Defaults to the current year only; options: `--since YYYY-MM-DD`, `--replies`, `--retweets`.
3. Commit and push `tweets.json`.

## Files

| File | Purpose |
|---|---|
| `index.html` | X-style timeline |
| `add.html` | Add a post, bookmarklet |
| `render.js` | Renders a single post |
| `conversation.js` | Canonical-ID graph, connected conversations, counts and copyable transcript |
| `capture.js` | Captures exact visible text and explicit reply evidence from a user-opened X page |
| `style.css` | Light and dark theme |
| `tweets.json` | Profile and posts (the only "database") |
| `.github/workflows/add-tweet.yml`, `scripts/add-tweet.js` | Issue → post |
| `scripts/import-archive.js` | Import from an X data archive |
| `scripts/post-data.js`, `scripts/import-capture.js` | Preserve and merge conversation captures |
| `scripts/conversation-report.js` | Report saved-source coverage and unresolved context |
| `scripts/privacy-guard.js` | Blocks private terms on every push |

Run `npm test` and `node scripts/privacy-guard.js` before committing. Tests cover the saved conversation graph, exact body preservation, issue/archive ingestion, DOM rendering/filter context and clipboard output. A DOM harness does not verify browser layout.

X changes its markup now and then. If the bookmarklet stops finding posts, the selectors are at the bottom of `add.html`.

MIT licensed.

