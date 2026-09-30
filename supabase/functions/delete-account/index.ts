// Supabase Edge Function: permanently deletes the calling player's account.
// Deploy:  supabase functions deploy delete-account
// Optional (recommended for Sign in with Apple, required by Apple's account-deletion rules):
//   supabase secrets set APPLE_TEAM_ID=... APPLE_KEY_ID=... APPLE_CLIENT_ID=com.limelizardgames.slimepedia \
//     APPLE_PRIVATE_KEY="$(cat AuthKey_XXXX.p8)"
import { createClient } from 'npm:@supabase/supabase-js@2';
import { SignJWT, importPKCS8 } from 'npm:jose@5';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

/** Exchanges the authorization code for a refresh token and revokes it with Apple. */
async function revokeApple(code: string) {
  const teamId = Deno.env.get('APPLE_TEAM_ID');
  const keyId = Deno.env.get('APPLE_KEY_ID');
  const clientId = Deno.env.get('APPLE_CLIENT_ID');
  const pem = Deno.env.get('APPLE_PRIVATE_KEY');
  if (!teamId || !keyId || !clientId || !pem) return 'skipped (Apple secrets not set)';
  const key = await importPKCS8(pem, 'ES256');
  const clientSecret = await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: keyId })
    .setIssuer(teamId)
    .setIssuedAt()
    .setExpirationTime('5m')
    .setAudience('https://appleid.apple.com')
    .setSubject(clientId)
    .sign(key);
  const form = (o: Record<string, string>) => new URLSearchParams(o);
  const tokenRes = await fetch('https://appleid.apple.com/auth/token', {
    method: 'POST',
    body: form({ grant_type: 'authorization_code', code, client_id: clientId, client_secret: clientSecret }),
  });
  const tokens = await tokenRes.json();
  const token = tokens.refresh_token ?? tokens.access_token;
  if (!token) return `token exchange failed: ${JSON.stringify(tokens)}`;
  const revokeRes = await fetch('https://appleid.apple.com/auth/revoke', {
    method: 'POST',
    body: form({ token, token_type_hint: tokens.refresh_token ? 'refresh_token' : 'access_token', client_id: clientId, client_secret: clientSecret }),
  });
  return revokeRes.ok ? 'revoked' : `revoke failed: ${revokeRes.status}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const url = Deno.env.get('SUPABASE_URL')!;
  const authHeader = req.headers.get('Authorization') ?? '';
  const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await asUser.auth.getUser();
  if (!user) return json({ error: 'Not signed in' }, 401);

  const { appleAuthorizationCode } = await req.json().catch(() => ({}));
  let apple = 'n/a';
  if (appleAuthorizationCode) {
    try { apple = await revokeApple(appleAuthorizationCode); } catch (e) { apple = `error: ${e}`; }
  }

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  await admin.from('saves').delete().eq('user_id', user.id);
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return json({ error: error.message }, 500);
  return json({ deleted: true, apple });
});
