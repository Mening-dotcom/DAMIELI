const Database = require('better-sqlite3');
const db = new Database('.data/damieli.sqlite', { readonly: true });
const users = db.prepare('SELECT id,email,createdAt FROM users').all();
console.log(JSON.stringify(users, null, 2));
