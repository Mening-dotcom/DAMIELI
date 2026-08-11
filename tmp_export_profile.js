const Database = require('better-sqlite3');
const db = new Database('.data/hireme.sqlite', { readonly: true });
const user = db.prepare("SELECT id,email,passwordHash,createdAt FROM users WHERE email = ?").get('menabravo.steven@gmail.com');
const profile = db.prepare("SELECT profile,stats FROM app_state WHERE userId = ?").get(user ? user.id : '');
console.log('user', JSON.stringify(user, null, 2));
console.log('profile', JSON.stringify(profile, null, 2));
db.close();
