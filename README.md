# Wikidata Public Art Game

A [Wikidata Distributed Game](https://wikidata-game.toolforge.org/distributed/)
that asks players to look at an artwork and decide whether it is **public art**
— permanently placed in a publicly accessible location.

When a player clicks **Yes**, two statements are added to the Wikidata item
in a single edit:

- `genre (P136) → public art (Q557141)`
- `on focus list of Wikimedia project (P5008) → WikiProject Public art (Q14942900)`

## How it works

- `api/game.js` is the game API (a Vercel serverless function). It answers the
  three calls the Distributed Game platform makes: `action=desc`,
  `action=tiles`, and `action=log_action`.
- `data/tiles.json` holds the pool of candidate Wikidata items to ask about.
- `scripts/refresh-tiles.mjs` queries [QLever](https://qlever.cs.uni-freiburg.de/wikidata)
  for artworks that have an image, coordinates, an administrative location,
  and no genre yet — and rewrites `data/tiles.json`.
- `.github/workflows/refresh.yml` runs that script every Monday at 03:00 UTC
  (and you can trigger it by hand from the Actions tab).

Every time `data/tiles.json` changes, Vercel automatically redeploys the
updated game, so the pool stays fresh without any manual work.

## Endpoint

After deploying to Vercel, your API URL is:

```
https://<your-project>.vercel.app/api/game
```

That is what you register in the Distributed Game.

## Tweaks you may want later

- **Add an icon.** Put a PNG roughly 120 px on its longer side at the root of
  the repo and add `icon: 'https://<your-project>.vercel.app/icon.png'` inside
  `DESCRIPTION` in `api/game.js`.
- **Narrow or broaden the pool.** Edit the SPARQL in
  `scripts/refresh-tiles.mjs`. For example, to target only a single country,
  add `?item wdt:P17 wd:Q55 .` (Netherlands) inside the `WHERE` block.
- **Change the schedule.** Edit the `cron` line in the GitHub Actions workflow.
