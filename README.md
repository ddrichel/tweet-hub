# Tweet Hub

Deine Tweets als eigene Timeline auf GitHub Pages – ohne X-API, ohne Server, ohne Kosten.
Your tweets as your own timeline on GitHub Pages – no X API, no server, no cost. *(English below.)*

## So funktioniert's

1. Du postest wie gewohnt auf X.
2. Auf x.com klickst du das **Tweet-Hub-Bookmarklet** (auf der Tweet-Seite oder deinem Profil).
3. GitHub öffnet ein vorausgefülltes Issue → **Submit**.
4. Eine GitHub Action trägt den Tweet in `tweets.json` ein, schließt das Issue, und er erscheint in der Timeline.

Kein Token, keine Secrets: Du bist bei GitHub ohnehin eingeloggt, und die Action übernimmt nur Issues vom Repo-Besitzer.

## Eigene Instanz in 2 Minuten

1. **Forken.** Repo-Name ist frei wählbar.
2. **Actions erlauben** (bei Forks: Tab „Actions“ → aktivieren).
3. **GitHub Pages aktivieren:** Settings → Pages → Branch `main`, Ordner `/ (root)`.
4. **Profil anpassen:** In `tweets.json` Name, Handle und Bio eintragen, `tweets` leer lassen.
5. `https://<dein-name>.github.io/<repo>/add.html` öffnen und das Bookmarklet in die Lesezeichenleiste ziehen.

## Dateien

| Datei | Zweck |
|---|---|
| `index.html` | Timeline im X-Stil |
| `add.html` | Tweet übernehmen, Bookmarklet, Einstellungen |
| `render.js` | Darstellung eines Tweets |
| `style.css` | Hell/Dunkel-Design |
| `tweets.json` | Profil und Tweets (die einzige „Datenbank“) |
| `.github/workflows/add-tweet.yml`, `scripts/add-tweet.js` | Issue → Tweet |
| `scripts/import-archive.js` | Import aus dem X-Datenarchiv |

Am Handy: in der X-App **Teilen → Link kopieren**, `add.html` öffnen, „Link einfügen und speichern“, Submit. Den Text holt die Action selbst.

## Alle alten Tweets importieren

1. X-Archiv anfordern: https://x.com/settings/download_your_data (kommt nach ca. 24 h per Mail).
2. Entpacken, dann im Repo: `node scripts/import-archive.js <archiv-ordner>` (optional `--replies`, `--retweets`).
3. `tweets.json` committen und pushen.

---

## English

1. Fork, enable Actions and GitHub Pages (`main`, root).
2. Edit the profile in `tweets.json`.
3. Open `/add.html` and drag the bookmarklet to your bookmarks bar.
4. On x.com, click the bookmarklet on a tweet → GitHub opens a prefilled issue → Submit. An Action adds it to the timeline.

No tokens or secrets. Only issues opened by the repo owner are accepted. X's markup changes now and then; if the bookmarklet stops finding tweets, the selectors live at the bottom of `add.html`.

MIT licensed.
