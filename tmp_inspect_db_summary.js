const fs = require('fs');
const Database = require('better-sqlite3');
const inspect = (path) => {
  if (!fs.existsSync(path)) {
    console.log(path, 'missing');
    return;
  }
  console.log('\nDB', path);
  const db = new Database(path, { readonly: true });
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
  console.log('tables', tables);
  if (tables.includes('users')) {
    const dupe = db.prepare("SELECT LOWER(TRIM(email)) AS email, COUNT(*) AS c FROM users GROUP BY LOWER(TRIM(email)) HAVING c > 1").all();
    console.log('duplicate user emails', JSON.stringify(dupe));
    const count = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
    console.log('users count', count);
  }
  if (tables.includes('app_state')) {
    const count = db.prepare('SELECT COUNT(*) as c FROM app_state').get().c;
    console.log('app_state count', count);
  }
  if (tables.includes('history')) {
    const count = db.prepare('SELECT COUNT(*) as c FROM history').get().c;
    console.log('history count', count);
  }
  db.close();
};
inspect('.data/damieli.sqlite');
inspect('.data/hireme.sqlite');
if (fs.existsSync('.data/damieli.json')) {
  const content = JSON.parse(fs.readFileSync('.data/damieli.json', 'utf8'));
  const users = content.users || [];
  const dupes = users.reduce((acc, u) => {
    const email = String(u.email || '').trim().toLowerCase();
    if (!email) return acc;
    acc[email] = (acc[email] || 0) + 1;
    return acc;
  }, {});
  console.log('\nJSON damieli store users', users.length);
  console.log('duplicate user emails', JSON.stringify(Object.entries(dupes).filter(([, c]) => c > 1)));
}
if (fs.existsSync('.data/hireme.json')) {
  const content = JSON.parse(fs.readFileSync('.data/hireme.json', 'utf8'));
  const users = content.users || [];
  const dupes = users.reduce((acc, u) => {
    const email = String(u.email || '').trim().toLowerCase();
    if (!email) return acc;
    acc[email] = (acc[email] || 0) + 1;
    return acc;
  }, {});
  console.log('\nJSON hireme store users', users.length);
  console.log('duplicate user emails', JSON.stringify(Object.entries(dupes).filter(([, c]) => c > 1)));
}
