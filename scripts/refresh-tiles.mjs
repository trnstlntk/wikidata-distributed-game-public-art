// Refreshes data/tiles.json with the latest candidate artworks from Wikidata.
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

const QLEVER_ENDPOINT = 'https://qlever.cs.uni-freiburg.de/api/wikidata';

// Artworks that:
//   - are a certain type (P31) of work, such as sculpture, or statue,
//   - have an image (P18),
//   - are located in an administrative territorial entity (P131),
//   - have coordinates (P625),
//   - AND do NOT yet have a genre (P136).
//
// The LIMIT caps the pool at 20,000 items; plenty for a game, and keeps the
// generated JSON under ~1 MB.
const QUERY = `
PREFIX wd:  <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>

SELECT DISTINCT ?item WHERE {
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
}
LIMIT 20000
`;

async function main() {
  console.log('Fetching candidate artworks from QLever…');

  const response = await fetch(QLEVER_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/sparql-query',
      'Accept':       'application/sparql-results+json',
      'User-Agent':   'wikidata-public-art-game (refresh script)'
    },
    body: QUERY
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`QLever request failed: ${response.status} ${response.statusText}\n${text}`);
  }

  const data = await response.json();
  const items = data.results.bindings
    .map(b => b.item.value.replace('http://www.wikidata.org/entity/', ''))
    .filter(qid => /^Q\d+$/.test(qid));

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
