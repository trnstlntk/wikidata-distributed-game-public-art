// Refreshes data/tiles.json with the latest candidate artworks from Wikidata,
// along with enrichment data (collection, location, part of, creator, inception)
// to help players decide whether something is public art.
//
// Runs automatically via GitHub Actions on a weekly schedule
// (see .github/workflows/refresh.yml). Can also be triggered manually
// from the Actions tab in GitHub, or run locally with:
//   node scripts/refresh-tiles.mjs

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const outputPath = join(__dirname, '..', 'data', 'tiles.json');

const QLEVER_ENDPOINT = 'https://query.wikidata.org/sparql';

// Artworks that:
//   - are a certain type (P31) of work (allowlist below),
//   - have an image (P18),
//   - are located in an administrative territorial entity (P131),
//   - have coordinates (P625),
//   - AND do NOT yet have a genre (P136).
//
// Enrichment fields fetched per item (all OPTIONAL — items won't have all):
//   - collection (P195)   — museum/collection the work belongs to
//   - location   (P276)   — specific location
//   - part of    (P361)   — e.g. the building a relief is part of
//   - creator    (P170)   — artist
//   - inception  (P571)   — date of creation (year extracted client-side)
//
// We aggregate with SAMPLE + GROUP BY so items with multiple values of a
// field collapse to one row (we only need one example for display).
//
// The LIMIT caps the pool at 20,000 items; plenty for a game.
const QUERY = `
PREFIX wd:   <http://www.wikidata.org/entity/>
PREFIX wdt:  <http://www.wikidata.org/prop/direct/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?item
       (SAMPLE(?collectionLabel_) AS ?collection)
       (SAMPLE(?locationLabel_)   AS ?location)
       (SAMPLE(?partOfLabel_)     AS ?partOf)
       (SAMPLE(?creatorLabel_)    AS ?creator)
       (SAMPLE(?inception_)       AS ?inception)
WHERE {
  VALUES ?type {
    wd:Q860861    # sculpture
    wd:Q179700    # statue
    wd:Q245117    # relief sculpture
    wd:Q2293362   # group of sculptures
    wd:Q20437094  # installation artwork
    wd:Q241045    # bust
    wd:Q3476515   # architectural sculpture
    wd:Q928357    # bronze sculpture
  }
  ?item wdt:P31   ?type ;
        wdt:P18   ?image ;
        wdt:P131  ?admin ;
        wdt:P625  ?coord .
  MINUS { ?item wdt:P136 ?genre }
  MINUS { ?item wdt:P17 wd:Q213. }

  OPTIONAL {
    ?item wdt:P195 ?collection_ .
    ?collection_ rdfs:label ?collectionLabel_ .
    FILTER(LANG(?collectionLabel_) = "en")
  }
  OPTIONAL {
    ?item wdt:P276 ?location_ .
    ?location_ rdfs:label ?locationLabel_ .
    FILTER(LANG(?locationLabel_) = "en")
  }
  OPTIONAL {
    ?item wdt:P361 ?partOf_ .
    ?partOf_ rdfs:label ?partOfLabel_ .
    FILTER(LANG(?partOfLabel_) = "en")
  }
  OPTIONAL {
    ?item wdt:P170 ?creator_ .
    ?creator_ rdfs:label ?creatorLabel_ .
    FILTER(LANG(?creatorLabel_) = "en")
  }
  OPTIONAL { ?item wdt:P571 ?inception_ . }
}
GROUP BY ?item
LIMIT 20000
`;

// Extract a plain integer year from an ISO-8601 datetime string like
// "1503-01-01T00:00:00Z" or "-0500-01-01T00:00:00Z" (BCE).
function extractYear(iso) {
  if (!iso) return null;
  const m = iso.match(/^(-?\d+)-/);
  return m ? parseInt(m[1], 10) : null;
}

async function main() {
  console.log('Fetching candidate artworks from QLever…');

  const response = await fetch(QLEVER_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/sparql-query',
      'Accept':       'application/sparql-results+json',
      'User-Agent':   'wikidata-public-art-game/1.0 (https://github.com/trnstlntk/wikidata-distributed-game-public-art; refresh script)'
    },
    body: QUERY
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`QLever request failed: ${response.status} ${response.statusText}\n${text}`);
  }

  const data = await response.json();
  const items = [];

  for (const b of data.results.bindings) {
    const uri = b.item?.value;
    if (!uri) continue;
    const qid = uri.replace('http://www.wikidata.org/entity/', '');
    if (!/^Q\d+$/.test(qid)) continue;

    const record = { qid };
    if (b.collection) record.collection = b.collection.value;
    if (b.location)   record.location   = b.location.value;
    if (b.partOf)     record.partOf     = b.partOf.value;
    if (b.creator)    record.creator    = b.creator.value;
    if (b.inception) {
      const year = extractYear(b.inception.value);
      if (year !== null) record.inception = year;
    }
    items.push(record);
  }

  console.log(`Got ${items.length} candidate items.`);

  const output = {
    generated_at: new Date().toISOString(),
    count: items.length,
    items: items
  };

  writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n');
  console.log(`Wrote ${outputPath}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
