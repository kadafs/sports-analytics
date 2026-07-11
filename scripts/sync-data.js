import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In the standalone Sports Analytics repo, data lives inside public/data/
// It is pushed here by ncaa-api's push_to_dashboard.py script.
const sports = ['football', 'basketball'];

console.log('Starting Sports Analytics data index generation...');

for (const sport of sports) {
  const dataDir = path.join(__dirname, '..', 'public', 'data', sport);

  console.log(`\n--- Indexing ${sport} ---`);
  console.log(`Data directory: ${dataDir}`);

  try {
    if (!fs.existsSync(dataDir)) {
      console.log(`⚠️ No data directory found for ${sport}, skipping...`);
      continue;
    }

    // Generate dates_index.json dynamically from whatever prediction files are present
    const files = fs.readdirSync(dataDir).filter(f =>
      f.startsWith('universal_predictions_') && f.endsWith('.json')
    );

    if (files.length === 0) {
      console.log(`⚠️ No prediction files found for ${sport}.`);
    }

    const dates = [];

    for (const file of files) {
      const dateStr = file.replace('universal_predictions_', '').replace('.json', '');
      try {
        const content = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf-8'));

        let scored_count = 0;
        if (content.predictions) {
          scored_count = content.predictions.filter(p => p.actual_result != null).length;
        }

        dates.push({
          date: dateStr,
          total: content.total_predictions || 0,
          graded: content.grade_summary != null,
          graded_count: scored_count,
          grade_summary: content.grade_summary || null
        });
      } catch (parseError) {
        console.warn(`⚠️ Skipping ${file} due to JSON parse error: ${parseError.message}`);
      }
    }

    // Deduplicate: when both 2026-07-10 and 2026-07-10_v2 exist, prefer _v2
    // Build a map keyed by base date (without _v2 suffix)
    const dateMap = new Map();
    for (const entry of dates) {
      const baseDate = entry.date.replace('_v2', '');
      const isV2 = entry.date.endsWith('_v2');
      if (!dateMap.has(baseDate) || isV2) {
        // Store with the actual file date (keeps _v2 suffix so fetchPredictions loads the right file)
        dateMap.set(baseDate, entry);
      }
    }

    const deduped = [...dateMap.values()].sort((a, b) => b.date.localeCompare(a.date));

    fs.writeFileSync(
      path.join(dataDir, 'dates_index.json'),
      JSON.stringify({ dates: deduped }, null, 2)
    );
    console.log(`✅ Generated ${sport} dates_index.json (${deduped.length} dates indexed).`);

  } catch (error) {
    console.error(`❌ Failed to index ${sport} data:`, error);
    process.exit(1);
  }
}

console.log('\n✅ All sports indexed successfully.');
