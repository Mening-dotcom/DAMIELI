const Database = require('better-sqlite3');
const db = new Database('.data/hireme.sqlite', { readonly: true });
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r=>r.name);
console.log('tables', tables);
if (tables.includes('users')) {
  const rows = db.prepare('SELECT id,email,createdAt FROM users').all();
  console.log('users', JSON.stringify(rows, null, 2));
} else {
  console.log('no users table');
}
if (tables.includes('history')) {
  console.log('history count', db.prepare('SELECT COUNT(*) AS c FROM history').get().c);
}
if (tables.includes('app_state')) {
  console.log('app_state count', db.prepare('SELECT COUNT(*) AS c FROM app_state').get().c);
}
db.close();
