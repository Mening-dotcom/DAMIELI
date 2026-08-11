const fs = require('fs');
const Database = require('better-sqlite3');
const files = ['.data/damieli.sqlite', '.data/hireme.sqlite'];
for (const file of files) {
  console.log('FILE:', file, 'exists=', fs.existsSync(file));
  if (fs.existsSync(file)) {
    try {
      const db = new Database(file, { readonly: true });
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      console.log('TABLES', tables.map(r => r.name));
      for (const table of tables) {
        if (['users','history','app_state'].includes(table.name)) {
          const rows = db.prepare(`SELECT * FROM ${table.name} LIMIT 10`).all();
          console.log('ROWS', table.name, JSON.stringify(rows, null, 2));
        }
      }
      db.close();
    } catch (e) {
      console.error('ERROR reading', file, e.message);
    }
  }
}
