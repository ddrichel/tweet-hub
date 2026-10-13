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
| `style.css` | Light and dark theme |
| `tweets.json` | Profile and posts (the only "database") |
| `.github/workflows/add-tweet.yml`, `scripts/add-tweet.js` | Issue → post |
| `scripts/import-archive.js` | Import from an X data archive |
| `scripts/privacy-guard.js` | Blocks private terms on every push |

X changes its markup now and then. If the bookmarklet stops finding posts, the selectors are at the bottom of `add.html`.

MIT licensed.
