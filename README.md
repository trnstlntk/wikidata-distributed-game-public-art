# Wikidata Public Art Game

A game for the [Wikidata Distributed Game](https://wikidata-game.toolforge.org/distributed/)
platform that invites players to look at an artwork's photo and location and decide:
**is this public art?**

"Public art," for the purposes of this game, means an artwork that is
**permanently placed in a publicly accessible location** — think of an outdoor
sculpture on a city square, a mural on a building façade, or a memorial fountain
in a park. Not a grave in a cemetery, not an artwork inside a museum,
a private gallery, or someone's home.

When a player answers **Yes**, two statements are added to the Wikidata item in a
single edit:

- `genre (P136) → public art (Q557141)`
- `on focus list of Wikimedia project (P5008) → Wikidata:WikiProject Public art (Q14942900)`

A **No** answer records the player's opinion but makes no edit (the item may
well have a specific, non-public-art genre that someone better informed can add
later). A **Don't know** answer skips the tile without recording anything.

## Play the game

The game is currently running in **test mode** — it's not yet permanently listed
on the Distributed Game homepage. You can play it directly via this link:

**▶ [Play: Is this public art?](https://wikidata-game.toolforge.org/distributed/#mode=test_game&url=https%3A%2F%2Fwikidata-distributed-game-public-ar.vercel.app%2Fapi%2Fgame)**

A few things to know before you play:

- You need a **Wikidata account**, and you'll be asked to authorize the
  Distributed Game via OAuth the first time. Every "Yes" click becomes a real
  edit on Wikidata, credited to your username.
- If you're not sure whether the photo shows public art, please click **Don't
  know** rather than guessing — it costs nothing and keeps the data clean.
- Edits made through this game are tagged "Distributed Game" in the item's
  edit history, so they can be reviewed and, if needed, reverted like any other
  Wikidata edit.

## How it works

The Distributed Game platform itself holds no game data. Instead, each game is
a small web API hosted elsewhere that provides **tiles** (individual tasks) on
request. This repository is that API.

Four things make the whole thing tick:

- **`api/game.js`** — a small serverless function, hosted on Vercel, that
  responds to the three calls the Distributed Game platform makes:
  `action=desc` for the game's title and description, `action=tiles` for a batch
  of tasks to play, and `action=log_action` when a player decides. Each tile is
  built from a Wikidata QID plus three buttons.
- **`data/tiles.json`** — the current pool of candidate items. Roughly 20 000
  QIDs at any given time, filtered to artworks that have an image, an
  administrative location, and coordinates, but no genre yet.
- **`scripts/refresh-tiles.mjs`** — a Node.js script that queries
  [QLever](https://qlever.cs.uni-freiburg.de/wikidata) (a very fast
  alternative SPARQL endpoint for Wikidata) for fresh candidates and rewrites
  `data/tiles.json`.
- **`.github/workflows/refresh.yml`** — a GitHub Actions workflow that runs
  the refresh script every Monday at 03:00 UTC, commits the updated pool back
  to the repository, and can also be triggered manually from the Actions tab.

Every commit to `main` — including the weekly one made by the bot — triggers
an automatic redeploy on Vercel, so the served pool stays in sync with the
repository without any human intervention.

The SPARQL query uses an **allowlist of P31 (instance of) values**, chosen from
the types most frequently used on existing public-art items on Wikidata:
sculpture, statue, war memorial, monument, fountain, memorial, mural, relief
sculpture, group of sculptures, commemorative plaque, memorial stone,
installation artwork, water well, bust, architectural sculpture, memorial
column, drinking fountain, bronze sculpture. This is narrower (and much faster
to query) than walking the full subclass tree of `work of art (Q838948)`, and
avoids sweeping in things like Stolpersteine, buildings, or generic
"works of art" that turned out to add noise during early testing.

## How it was built

This project was built in a single afternoon in April 2026 by a non-developer
in conversation with [Claude](https://claude.ai), Anthropic's AI assistant, as
an experiment in what a small Wikidata tool looks like when you build it that
way. The main human contributions were the idea, the domain knowledge about
public art and Wikidata modelling, the decisions about what to include and
exclude, and all the testing and deployment clicks; the AI drafted the code,
explained concepts, wrote the SPARQL, and debugged along the way.

The underlying Distributed Game platform was created by
[Magnus Manske](https://www.wikidata.org/wiki/User:Magnus_Manske), whose
[original blog post](http://magnusmanske.de/wordpress/?p=362) and
[API documentation](https://codeberg.org/magnusmanske/wikidata-game/src/branch/master/public_html/distributed)
made this game possible with roughly 200 lines of code on top.

## Maintenance

Under normal operation, there is nothing to do. The GitHub Action refreshes
`data/tiles.json` every Monday, and Vercel redeploys automatically.

If the pool ever runs low, or you want to refresh it manually, go to the
**Actions** tab of this repository, choose the **Refresh tiles** workflow, and
click **Run workflow**. A green checkmark appears after ~20 seconds, and a new
deploy on Vercel follows within a few more seconds.

## Tweaking the game

Small changes are easy, and most of them live in just two files:

- **To change the types of artworks included**, edit the `VALUES ?type { … }`
  block in `scripts/refresh-tiles.mjs`. Add a new `wd:Q…` line to include a
  type, delete one to exclude it. After committing, trigger the refresh
  workflow once manually so the pool regenerates immediately instead of
  waiting until next Monday.
- **To limit the game to a single country or region**, add a line like
  `?item wdt:P17 wd:Q55 .` (for the Netherlands) inside the `WHERE` block of
  the same SPARQL query.
- **To change the game's title, description, or button labels**, edit the
  `DESCRIPTION` object or the `makeTile` function near the top of
  `api/game.js`.
- **To change the refresh schedule**, edit the `cron` expression in
  `.github/workflows/refresh.yml`.

All of these edits can be made directly in GitHub's web editor — no local
development setup is required. Vercel redeploys automatically on every push.

## Credits and license

Built on top of [Wikidata - The Distributed Game](https://www.wikidata.org/wiki/Q26919966)
by Magnus Manske. Game data queried from [Wikidata](https://www.wikidata.org/)
via [QLever](https://qlever.cs.uni-freiburg.de/wikidata). Hosted on
[Vercel](https://vercel.com).

The code in this repository is released into the public domain under
[CC0](https://creativecommons.org/publicdomain/zero/1.0/) unless otherwise
noted. Wikidata content is licensed CC0 as well.
