const Database = require('better-sqlite3');
const db = new Database('.data/hireme.sqlite', { readonly: true });
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('TABLES', tables.map(r => r.name));
for (const table of tables.map(r => r.name)) {
  const count = db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get().c;
  console.log(table, 'count', count);
  if (table === 'users' || table === 'history' || table === 'app_state') {
    const rows = db.prepare(`SELECT * FROM ${table} LIMIT 20`).all();
    console.log('ROWS', table, JSON.stringify(rows, null, 2));
  }
}
db.close();
