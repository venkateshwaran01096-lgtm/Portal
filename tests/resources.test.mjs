import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';

// Run the real handler with storage, database and identity boundaries replaced.
async function fixture(role = 'admin') {
  const rows = new Map();
  const blobs = new Map();
  let wanted;
  const db = {
    select() { return { from(table) { return { where(filter) {
      wanted = filter;
      if (table === 'courses') return Promise.resolve([{ id: 'CS101' }]);
      const values = [...rows.values()].filter(row => row[filter.key] === filter.value);
      const result = Promise.resolve(values);
      result.orderBy = () => Promise.resolve(values);
      return result;
    } }; } }; },
    insert() { return { values(record) { return { returning: async () => { rows.set(record.id, record); return [record]; } }; } }; },
    delete() { return { where: async filter => rows.delete(filter.value) }; },
  };
  const store = { set: async (id, bytes) => blobs.set(id, bytes), get: async id => blobs.get(id) ?? null, delete: async id => blobs.delete(id) };
  globalThis.__portalTest = { database: () => db, getStore: () => store, getUser: async () => role ? { roles: [role] } : null,
    eq: (key,value) => ({key,value}), desc: key => key,
    resources: {id:'id',subjectId:'subjectId',createdAt:'createdAt'}, courses: 'courses' };
  let source = fs.readFileSync('netlify/functions/resources.mts', 'utf8');
  source = source.replace(/^import .*?;\n/gm, match => match.includes('node:crypto') ? match : '');
  source = 'const { database, getStore, getUser, eq, desc, resources, courses } = globalThis.__portalTest;\n' + source;
  const js = stripTypeScriptTypes(source);
  const { default: handler } = await import('data:text/javascript;base64,' + Buffer.from(js + '\n//' + Math.random()).toString('base64'));
  return { handler, rows, blobs };
}
function upload(bytes = '%PDF-1.7\noriginal document bytes') {
  const form = new FormData();
  form.set('file', new File([bytes], 'original.pdf', {type:'application/pdf'}));
  form.set('title','Lecture notes');form.set('category','notes');form.set('subject','CS101');
  return new Request('https://portal.test/.netlify/functions/resources', {method:'POST',body:form});
}
test('admin upload survives independent student reads, downloads exact bytes, and deletes', async () => {
  const {handler,rows,blobs} = await fixture();
  const result = await handler(upload()); assert.equal(result.status,201);
  const record = await result.json();assert.equal(rows.size,1);assert.equal(blobs.size,1);
  const list = await handler(new Request('https://portal.test/?subject=CS101'));
  assert.equal((await list.json())[0].title,'Lecture notes');
  const downloaded = await handler(new Request('https://portal.test/?id='+record.id));
  assert.equal(await downloaded.text(),'%PDF-1.7\noriginal document bytes');
  assert.match(downloaded.headers.get('content-disposition'),/original.pdf/);
  const removed = await handler(new Request('https://portal.test/?id='+record.id,{method:'DELETE'}));
  assert.equal(removed.status,200); assert.equal(blobs.size,0);assert.equal(rows.size,0);
  assert.equal((await handler(new Request('https://portal.test/?id='+record.id))).status,404);
});
test('students and anonymous visitors cannot upload or delete', async () => {
  for (const role of ['student',null]) {
    const {handler,blobs} = await fixture(role);
    assert.equal((await handler(upload())).status,403);
    assert.equal((await handler(new Request('https://portal.test/?id=existing',{method:'DELETE'}))).status,403);
    assert.equal(blobs.size,0);
  }
});
test('rejects invalid PDF contents and empty uploads', async () => {
  const {handler,rows,blobs} = await fixture();
  assert.equal((await handler(upload('not a PDF'))).status,400);
  assert.equal((await handler(upload(''))).status,400);
  assert.equal(rows.size,0); assert.equal(blobs.size,0);
});
test('browser script parses and uses real download and delete controls', () => {
  const html = fs.readFileSync('public/index.html','utf8');
  const source = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
  new vm.Script(source);
  assert.ok(!source.includes('simulateDownload'));
  assert.match(source,/downloadFile\('\$\{file.id\}'/);
  assert.match(source,/deleteFile\('\$\{file.id\}'/);
});
