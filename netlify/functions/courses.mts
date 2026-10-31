import { getUser } from '@netlify/identity';
import { eq } from 'drizzle-orm';
import { database } from '../../db/index.js';
import { courses, resources } from '../../db/schema.js';
export default async (request: Request) => {
  try {
    const db = database();
    if (request.method === 'GET') return Response.json(await db.select().from(courses), { headers: { 'Cache-Control': 'no-store' } });
    const user = await getUser();
    if (!user?.roles?.includes('admin')) return Response.json({ error: 'Admin access required.' }, { status: 403 });
    const data = await request.json();
    if (request.method === 'DELETE') {
      const attached = await db.select({ id: resources.id }).from(resources).where(eq(resources.subjectId, data.id)).limit(1);
      if (attached.length) return Response.json({ error: 'Delete the files in this course before deleting the course.' }, { status: 409 });
      await db.delete(courses).where(eq(courses.id, data.id));
      return Response.json({ ok: true });
    }
    if (!['POST', 'PUT'].includes(request.method)) return new Response(null, { status: 405 });
    if (!/^[A-Z0-9_-]{1,40}$/.test(data.id) || typeof data.title !== 'string' || !data.title.trim() || data.title.length > 200 || ![1,2].includes(data.year) || !(data.year === 1 ? ['1st Semester','2nd Semester'] : ['3rd Semester','4th Semester']).includes(data.semester)) {
      return Response.json({ error: 'Enter a valid course code, name, year and semester.' }, { status: 400 });
    }
    const values = { id: data.id, title: data.title.trim(), year: data.year, semester: data.semester };
    if (request.method === 'POST') await db.insert(courses).values(values);
    else await db.update(courses).set(values).where(eq(courses.id, data.oldCode));
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: 'Unable to save courses. Check for duplicate course codes and retry.' }, { status: 500 });
  }
};
