// Wikidata Distributed Game: "Is this public art?"
// This is a Vercel serverless function. It handles the three API actions
// the Distributed Game platform calls: desc, tiles, and log_action.
//
// Endpoint URL (after you deploy to Vercel):
//   https://<your-project>.vercel.app/api/game

const tiles = require('../data/tiles.json');

// --- Wikidata identifiers used by the edit action -------------------------
const PUBLIC_ART_QID  = 557141;    // Q557141  public art
const WIKIPROJECT_QID = 14942900;  // Q14942900 Wikidata:WikiProject Public art

// --- Game description (returned for action=desc) --------------------------
const DESCRIPTION = {
  label: {
    en: 'Is this public art?'
  },
  description: {
    en: "Look at an artwork's image and location, then decide whether it is public art. Public art means: permanently placed in a publicly accessible location. Note that memorials in cemeteries are often not permanently publicly accessible!"
  }
  // You can add an "icon" field here later, pointing at a 120px PNG/JPG URL.
  // e.g.  icon: 'https://<your-project>.vercel.app/icon.png'
};

// --- Main handler ---------------------------------------------------------
module.exports = function handler(req, res) {
  const q = req.query || {};
  const action   = q.action;
  const callback = q.callback;

  // Sanitize the JSONP callback name — only allow characters that are safe
  // as a JavaScript identifier. This prevents XSS via a malicious callback.
  const safeCallback =
    typeof callback === 'string' && /^[A-Za-z_$][A-Za-z0-9_$.]{0,80}$/.test(callback)
      ? callback
      : 'callback';

  let payload;

  if (action === 'desc') {
    payload = DESCRIPTION;

  } else if (action === 'tiles') {
    const n = Math.max(1, Math.min(10, parseInt(q.num, 10) || 1));
    payload = { tiles: pickTiles(n) };
    // Warn the platform if the pool is getting low
    if (tiles.items && tiles.items.length < 100) payload.low = 1;

  } else if (action === 'log_action') {
    // Fire-and-forget: we don't keep server-side state.
    // Once the Wikidata edit is made, the item drops out of the next SPARQL
    // refresh, so it won't come back as a future tile.
    console.log(`user=${q.user} tile=${q.tile} decision=${q.decision}`);
    payload = { status: 'ok' };

  } else {
    payload = { error: 'Unknown action', action: action };
  }

  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(`${safeCallback}(${JSON.stringify(payload)})`);
};

// --- Helpers --------------------------------------------------------------
function pickTiles(n) {
  const items = (tiles && tiles.items) || [];
  if (items.length === 0) return [];

  const chosen = [];
  const used = new Set();
  while (chosen.length < n && used.size < items.length) {
    const i = Math.floor(Math.random() * items.length);
    if (used.has(i)) continue;
    used.add(i);
    chosen.push(makeTile(items[i]));
  }
  return chosen;
}

function makeTile(qid) {
  const numericId = parseInt(qid.substring(1), 10); // strip the leading 'Q'

  // The JSON payload for wbeditentity: two claims added in one atomic edit.
  // The Distributed Game requires every api_action value to be a string,
  // so we stringify this before putting it in the action object.
  const editData = {
    claims: [
      {
        mainsnak: {
          snaktype: 'value',
          property: 'P136',   // genre
          datavalue: {
            value: { 'entity-type': 'item', 'numeric-id': PUBLIC_ART_QID },
            type: 'wikibase-entityid'
          }
        },
        type: 'statement',
        rank: 'normal'
      },
      {
        mainsnak: {
          snaktype: 'value',
          property: 'P5008',  // on focus list of Wikimedia project
          datavalue: {
            value: { 'entity-type': 'item', 'numeric-id': WIKIPROJECT_QID },
            type: 'wikibase-entityid'
          }
        },
        type: 'statement',
        rank: 'normal'
      }
    ]
  };

  return {
    id: numericId,
    sections: [
      { type: 'item', q: qid }
    ],
    controls: [
      {
        type: 'buttons',
        entries: [
          {
            type: 'green',
            decision: 'yes',
            label: 'Yes, public art',
            api_action: {
              action: 'wbeditentity',
              id: qid,
              data: JSON.stringify(editData)
            }
          },
          {
            type: 'white',
            decision: 'skip',
            label: "Don't know"
          },
          {
            type: 'blue',
            decision: 'no',
            label: 'No, not public art'
          }
        ]
      }
    ]
  };
}
