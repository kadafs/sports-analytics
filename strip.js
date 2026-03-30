const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'public', 'data', 'football');

try {
  const files = fs.readdirSync(dir).filter(f => f.includes('predictions_'));

  files.forEach(file => {
    const filepath = path.join(dir, file);
    try {
      const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
      let strippedCount = 0;
      if (data.predictions && Array.isArray(data.predictions)) {
        data.predictions.forEach(p => {
          if (p.match_center) {
            delete p.match_center;
            strippedCount++;
          }
        });
        if (strippedCount > 0) {
          fs.writeFileSync(filepath, JSON.stringify(data));
          const newSize = (fs.statSync(filepath).size / (1024*1024)).toFixed(2);
          console.log(`Successfully stripped match_center from ${strippedCount} predictions in ${file}. New size: ${newSize} MB`);
        }
      }
    } catch (e) {
      console.error(`Error processing ${file}:`, e.message);
    }
  });
} catch(err) {
  console.error("Directory error:", err);
}
