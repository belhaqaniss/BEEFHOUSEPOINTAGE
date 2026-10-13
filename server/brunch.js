export const canEditBrunch = admin => admin?.role === 'superadmin' && admin.username === '0634545837';

const defaults = {
  notice: ['Disponible uniquement le week-end', 'Available on weekends only'],
  items: [
    ['Formule Signature', 'Signature set menu', 19.90, 'Un plat sucré ou salé + une boisson chaude (thé, espresso ou café crème) + un jus d’orange ou une citronnade.', 'One sweet or savoury dish + a hot drink (tea, espresso or café crème) + orange juice or lemonade.'],
    ['Formule Premium', 'Premium set menu', 29.90, 'Un plat sucré + un plat salé + une boisson chaude au choix + un jus d’orange ou une citronnade.', 'One sweet dish + one savoury dish + a hot drink of your choice + orange juice or lemonade.'],
  ],
};

export function validateBrunch(value) {
  const text = (v, max, required = false) => {
    if (typeof v !== 'string' || v.length > max || (required && !v.trim())) throw Object.assign(new Error('Texte du brunch invalide'), {status:400});
    return v.trim();
  };
  if (!value || !Array.isArray(value.notice) || value.notice.length !== 2 || !Array.isArray(value.items) || value.items.length < 1 || value.items.length > 30) throw Object.assign(new Error('Le brunch doit contenir entre 1 et 30 formules'), {status:400});
  return {notice:value.notice.map(v => text(v, 300)), items:value.items.map(item => {
    if (!Array.isArray(item) || item.length !== 5 || typeof item[2] !== 'number' || !Number.isFinite(item[2]) || item[2] < 0 || item[2] > 1000) throw Object.assign(new Error('Prix ou formule invalide'), {status:400});
    return [text(item[0],120,true),text(item[1],120,true),Math.round(item[2]*100)/100,text(item[3],2000),text(item[4],2000)];
  })};
}

export function createBrunchStore(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS public_brunch (id INTEGER PRIMARY KEY CHECK(id=1), content TEXT NOT NULL, revision INTEGER NOT NULL, updated_at TEXT, updated_by TEXT);
    CREATE TABLE IF NOT EXISTS public_brunch_history (revision INTEGER PRIMARY KEY, content TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL);`);
  db.prepare('INSERT OR IGNORE INTO public_brunch(id,content,revision) VALUES(1,?,0)').run(JSON.stringify(defaults));
  const read = () => {
    const row=db.prepare('SELECT content,revision,updated_at FROM public_brunch WHERE id=1').get();
    return {brunch:JSON.parse(row.content),revision:row.revision,updatedAt:row.updated_at};
  };
  return {read, save(admin, content, revision) {
    if (!canEditBrunch(admin)) throw Object.assign(new Error('Accès à la modification du brunch refusé'), {status:403});
    const clean=validateBrunch(content);
    if (!Number.isInteger(revision)) throw Object.assign(new Error('Version manquante : rechargez le brunch'), {status:400});
    const now=new Date().toISOString();
    db.exec('BEGIN IMMEDIATE');
    try {
      const changed=db.prepare('UPDATE public_brunch SET content=?,revision=revision+1,updated_at=?,updated_by=? WHERE id=1 AND revision=?').run(JSON.stringify(clean),now,admin.username,revision);
      if (!changed.changes) throw Object.assign(new Error('Le brunch a été modifié entre-temps. Rechargez avant d’enregistrer.'), {status:409});
      db.prepare('INSERT INTO public_brunch_history(revision,content,updated_at,updated_by) VALUES(?,?,?,?)').run(revision+1,JSON.stringify(clean),now,admin.username);
      db.exec('COMMIT');
    } catch(error) { db.exec('ROLLBACK'); throw error; }
    return read();
  }};
}
