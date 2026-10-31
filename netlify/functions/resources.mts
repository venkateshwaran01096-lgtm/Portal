import { getStore } from '@netlify/blobs';
import { getUser } from '@netlify/identity';
import { eq, desc } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { database } from '../../db/index.js';
import { resources, courses } from '../../db/schema.js';

export default async (request: Request) => {
  try {
    const db = database();
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    const store = getStore({ name: 'academic-files', consistency: 'strong' });
    if (request.method === 'GET') {
      if (id) {
        const [file] = await db.select().from(resources).where(eq(resources.id, id));
        if (!file) return Response.json({ error: 'File no longer exists.' }, { status: 404 });
        const bytes = await store.get(file.id, { type: 'arrayBuffer' });
        if (!bytes) return Response.json({ error: 'File unavailable. Please contact the administrator.' }, { status: 404 });
        const filename = file.filename.replace(/[\r\n"\\]/g, '_').replace(/[^\x20-\x7e]/g, '_');
        return new Response(bytes, { headers: {
          'Content-Type': file.contentType,
          'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
          'Content-Length': String(file.size), 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
        } });
      }
      const subject = url.searchParams.get('subject');
      if (!subject) return Response.json({ error: 'Select a course.' }, { status: 400 });
      return Response.json(await db.select().from(resources).where(eq(resources.subjectId, subject)).orderBy(desc(resources.createdAt)), { headers: { 'Cache-Control': 'no-store' } });
    }
    const user = await getUser();
    if (!user?.roles?.includes('admin')) return Response.json({ error: 'Admin access required. Sign in again.' }, { status: 403 });
    if (request.method === 'DELETE') {
      if (!id) return Response.json({ error: 'Missing file.' }, { status: 400 });
      // Remove bytes first: on a storage failure the record remains available for retry.
      await store.delete(id);
      await db.delete(resources).where(eq(resources.id, id));
      return Response.json({ ok: true });
    }
    if (request.method !== 'POST') return new Response(null, { status: 405 });
    if (Number(request.headers.get('content-length')) > 4_700_000) return Response.json({ error: 'Maximum file size is 4 MB.' }, { status: 413 });
    const form = await request.formData();
    const file = form.get('file');
    const title = String(form.get('title') || '').trim();
    const subjectId = String(form.get('subject') || '');
    const category = String(form.get('category') || '');
    if (!(file instanceof File) || !title || title.length > 200 || !['papers','notes'].includes(category)) return Response.json({ error: 'Choose a file, category and title (up to 200 characters).' }, { status: 400 });
    if (!file.size || file.size > 4 * 1024 * 1024) return Response.json({ error: 'Choose a non-empty file up to 4 MB.' }, { status: 400 });
    const format = file.name.split('.').pop()?.toLowerCase();
    const types: Record<string, string> = { pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
    if (!format || !types[format]) return Response.json({ error: 'Only PDF and Word files are supported.' }, { status: 400 });
    const bytes = await file.arrayBuffer();
    const signature = new Uint8Array(bytes).slice(0, 8);
    const valid = format === 'pdf' ? Buffer.from(signature).toString().startsWith('%PDF-') : format === 'doc' ? Buffer.from(signature).toString('hex') === 'd0cf11e0a1b11ae1' : signature[0] === 0x50 && signature[1] === 0x4b && signature[2] === 3 && signature[3] === 4;
    if (!valid) return Response.json({ error: 'The file contents do not match its PDF or Word extension.' }, { status: 400 });
    const [course] = await db.select().from(courses).where(eq(courses.id, subjectId));
    if (!course) return Response.json({ error: 'Course no longer exists. Refresh and retry.' }, { status: 404 });
    const resourceId = randomUUID();
    await store.set(resourceId, bytes);
    try {
      const [record] = await db.insert(resources).values({ id: resourceId, subjectId, category, title, filename: file.name, format, contentType: types[format], size: file.size }).returning();
      return Response.json(record, { status: 201 });
    } catch (error) { await store.delete(resourceId); throw error; }
  } catch {
    return Response.json({ error: 'Unable to complete the file request. Please retry.' }, { status: 500 });
  }
};
