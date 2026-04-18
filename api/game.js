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
    en: "Look at an artwork's image and location, then decide whether it is public art — permanently placed in a publicly accessible location."
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
    if (tiles.items && tiles.items.length < 100) payload.low = 1;

  } else if (action === 'log_action') {
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

// Backwards-compatible: if `record` is a bare QID string (from the old
// tiles.json format), treat it as { qid: record }. Otherwise it's an object
// with qid plus optional enrichment fields.
function makeTile(record) {
  const entry = typeof record === 'string' ? { qid: record } : record;
  const qid = entry.qid;
  const numericId = parseInt(qid.substring(1), 10);

  const sections = [
    { type: 'item', q: qid }
  ];

  // Build an "Additional info" text section from any enrichment fields present.
  const lines = [];
  if (entry.collection) lines.push(`Collection: ${entry.collection}`);
  if (entry.location)   lines.push(`Location: ${entry.location}`);
  if (entry.partOf)     lines.push(`Part of: ${entry.partOf}`);
  if (entry.creator)    lines.push(`Creator: ${entry.creator}`);
  if (entry.inception !== undefined && entry.inception !== null) {
    // Inception is stored as a signed integer year; negative = BCE.
    lines.push(
      entry.inception < 0
        ? `Inception: ${-entry.inception} BCE`
        : `Inception: ${entry.inception}`
    );
  }
  if (lines.length > 0) {
    sections.push({
      type:  'text',
      title: 'Additional info',
      text:  lines.join('\n')
    });
  }

  // The JSON payload for wbeditentity: two claims added in one atomic edit.
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
    sections: sections,
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
