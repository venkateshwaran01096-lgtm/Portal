import { login, logout, getUser, acceptInvite } from '@netlify/identity';
export default async (request: Request) => {
  try {
    if (request.method === 'GET') {
      const user = await getUser();
      return Response.json({ admin: !!user?.roles?.includes('admin') }, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (request.method === 'DELETE') { await logout(); return Response.json({ ok: true }); }
    if (request.method !== 'POST') return new Response(null, { status: 405 });
    const { email, password, inviteToken } = await request.json();
    const user = inviteToken ? await acceptInvite(inviteToken, password) : await login(email, password);
    if (!user.roles?.includes('admin')) {
      await logout();
      return Response.json({ error: 'Your account needs the admin role. Contact the portal administrator.' }, { status: 403 });
    }
    return Response.json({ admin: true });
  } catch {
    return Response.json({ error: 'Unable to sign in. Check your email and password, or your invitation.' }, { status: 401 });
  }
};
