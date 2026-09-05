/**
 * End-to-end smoke test against a running API.
 *
 *   docker compose up -d
 *   cd backend && npm run start:dev        # in another shell
 *   node scripts/smoke.mjs
 *
 * This exercises the security properties that unit tests cannot: real JWTs,
 * the global guards, refresh-token rotation, the PostGIS radius filter, and
 * the authorization boundaries between two seeded accounts. It is read-mostly —
 * it registers one throwaway citizen and files one complaint.
 */

const BASE = process.env.SMOKE_API_URL || 'http://localhost:4000/api/v1';
const PASSWORD = 'Password123!';

let passed = 0;
let failed = 0;

function check(name, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function call(method, path, { token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* empty body */
  }
  return { status: res.status, json };
}

const login = async (email) => {
  const res = await call('POST', '/auth/login', { body: { email, password: PASSWORD } });
  if (res.status !== 200) throw new Error(`login ${email} failed: ${res.status} ${JSON.stringify(res.json)}`);
  return res.json.data;
};

async function main() {
  console.log(`\nCivicConnect smoke test → ${BASE}\n`);

  // ---------------------------------------------------------------- health
  console.log('health & public endpoints');
  check('GET /health is 200', (await call('GET', '/health')).status === 200);

  const orgs = await call('GET', '/organizations?limit=50');
  check('GET /organizations is public', orgs.status === 200);
  const approvedOnly = (orgs.json?.data ?? []).every((o) => o.verificationStatus === 'APPROVED');
  check('public org search returns only APPROVED facilities', approvedOnly);

  // ------------------------------------------------------- deny by default
  console.log('\ndeny-by-default guards');
  check('GET /complaints without a token is 401', (await call('GET', '/complaints')).status === 401);
  check('GET /auth/me without a token is 401', (await call('GET', '/auth/me')).status === 401);
  check(
    'GET /admin/users without a token is 401',
    (await call('GET', '/admin/users')).status === 401,
  );

  // ------------------------------------------------ register / login / me
  console.log('\nregistration & session lifecycle');
  const email = `smoke.${Date.now()}@example.invalid`;
  const reg = await call('POST', '/auth/register', {
    body: { email, password: PASSWORD, name: 'SMOKE Test Citizen', role: 'CITIZEN' },
  });
  check('POST /auth/register is 201', reg.status === 201, `got ${reg.status}`);

  const escalation = await call('POST', '/auth/register', {
    body: { email: `smoke.admin.${Date.now()}@example.invalid`, password: PASSWORD, name: 'SMOKE Escalation', role: 'ADMIN' },
  });
  check('self-registering as ADMIN is rejected', escalation.status === 400, `got ${escalation.status}`);

  const unknownField = await call('POST', '/auth/register', {
    body: { email: `smoke.wl.${Date.now()}@example.invalid`, password: PASSWORD, name: 'SMOKE Whitelist', isVerified: true },
  });
  check('unknown body properties are rejected (forbidNonWhitelisted)', unknownField.status === 400, `got ${unknownField.status}`);

  const session = await login(email);
  check('POST /auth/login returns an access token', !!session.tokens?.accessToken);
  check('POST /auth/login returns a refresh token', !!session.tokens?.refreshToken);

  const me = await call('GET', '/auth/me', { token: session.tokens.accessToken });
  check('GET /auth/me is 200 with a token', me.status === 200);
  check('GET /auth/me returns the right account', me.json?.data?.email === email);
  check('GET /auth/me never returns a password hash', !('passwordHash' in (me.json?.data ?? {})));

  // ------------------------------------------------------ refresh rotation
  console.log('\nrefresh token rotation');
  const refreshed = await call('POST', '/auth/refresh', {
    body: { refreshToken: session.tokens.refreshToken },
  });
  check('POST /auth/refresh is 200', refreshed.status === 200, `got ${refreshed.status}`);
  const rotated = refreshed.json?.data?.tokens;
  check('refresh issues a NEW refresh token (rotation)', !!rotated?.refreshToken && rotated.refreshToken !== session.tokens.refreshToken);

  const replay = await call('POST', '/auth/refresh', {
    body: { refreshToken: session.tokens.refreshToken },
  });
  check('replaying the old refresh token is rejected', replay.status === 401, `got ${replay.status}`);

  // --------------------------------------------------------- geo / PostGIS
  console.log('\nPostGIS proximity search');
  // Seed origin: DEMO — Northside General Hospital, Bengaluru.
  const origin = 'lat=12.9592&lng=77.6499';
  const tiers = {};
  for (const km of [2, 5, 15]) {
    const r = await call('GET', `/organizations?${origin}&radiusKm=${km}&limit=50`);
    tiers[km] = r.json?.data ?? [];
    check(`radius ${km}km returns 200`, r.status === 200);
    const total = r.json?.meta?.total;
    check(
      `radius ${km}km meta.total (${total}) equals the filtered row count (${tiers[km].length})`,
      total === tiers[km].length,
    );
  }
  check('widening the radius never loses results', tiers[2].length <= tiers[5].length && tiers[5].length <= tiers[15].length,
    `2km=${tiers[2].length} 5km=${tiers[5].length} 15km=${tiers[15].length}`);

  const distances = tiers[15].map((o) => o.distanceKm);
  check('every result carries a distanceKm', distances.every((d) => typeof d === 'number'));
  check('results are ordered nearest-first', distances.every((d, i) => i === 0 || d >= distances[i - 1]),
    JSON.stringify(distances));
  check('all distances are inside the requested radius', distances.every((d) => d <= 15));

  const noGeo = await call('GET', '/organizations?limit=5');
  check('search without coordinates reports distanceKm as null', (noGeo.json?.data ?? []).every((o) => o.distanceKm === null));

  const badGeo = await call('GET', '/organizations?lat=999&lng=77');
  check('out-of-range latitude is rejected', badGeo.status === 400, `got ${badGeo.status}`);

  // ------------------------------------------------------------- authz IDOR
  console.log('\nauthorization boundaries');
  const citizenA = await login('citizen@example.invalid');
  const citizenB = await login('citizen.two@example.invalid');
  const hospitalP = await login('hospital@example.invalid');
  const hospitalQ = await login('hospital.two@example.invalid');

  const filed = await call('POST', '/complaints', {
    token: citizenA.tokens.accessToken,
    body: { category: 'SMOKE test category', description: 'Filed by the smoke test to verify complaint scoping.' },
  });
  check('citizen A can file a complaint', filed.status === 201, `got ${filed.status}`);
  const complaintId = filed.json?.data?.id;

  const asB = await call('GET', `/complaints/${complaintId}`, { token: citizenB.tokens.accessToken });
  check("citizen B cannot read citizen A's complaint", asB.status === 404, `got ${asB.status}`);

  const asA = await call('GET', `/complaints/${complaintId}`, { token: citizenA.tokens.accessToken });
  check('citizen A can read their own complaint', asA.status === 200);

  const listB = await call('GET', '/complaints', { token: citizenB.tokens.accessToken });
  check("citizen B's list excludes citizen A's complaint",
    !(listB.json?.data ?? []).some((c) => c.id === complaintId));

  const citizenResolve = await call('PATCH', `/complaints/${complaintId}/resolve`, {
    token: citizenA.tokens.accessToken,
    body: { status: 'RESOLVED', resolutionNotes: 'Attempting self-resolution.' },
  });
  check('a citizen cannot resolve their own complaint', citizenResolve.status === 403, `got ${citizenResolve.status}`);

  // Cross-tenant write: hospital Q attempting to publish capacity for an org owned by P.
  const pOrgs = await call('GET', '/auth/me', { token: hospitalP.tokens.accessToken });
  const pOrgId = pOrgs.json?.data?.organizations?.[0]?.id;
  check('hospital P owns at least one organization', !!pOrgId);

  if (pOrgId) {
    const crossWrite = await call('PATCH', `/hospitals/${pOrgId}/capacity`, {
      token: hospitalQ.tokens.accessToken,
      body: { availableIcuBeds: 999 },
    });
    check("hospital Q cannot update hospital P's capacity", crossWrite.status === 403 || crossWrite.status === 404,
      `got ${crossWrite.status}`);

    const ownWrite = await call('PATCH', `/hospitals/${pOrgId}/capacity`, {
      token: hospitalP.tokens.accessToken,
      body: { availableIcuBeds: 7 },
    });
    check('hospital P can update its own capacity', ownWrite.status === 200, `got ${ownWrite.status}`);

    const escalate = await call('PATCH', `/organizations/${pOrgId}`, {
      token: hospitalP.tokens.accessToken,
      body: { verificationStatus: 'APPROVED' },
    });
    check('an org cannot set its own verificationStatus', escalate.status === 400, `got ${escalate.status}`);
  }

  const citizenAdmin = await call('GET', '/admin/users', { token: citizenA.tokens.accessToken });
  check('a citizen cannot reach admin endpoints', citizenAdmin.status === 403, `got ${citizenAdmin.status}`);

  // ------------------------------------------------------------ error shape
  console.log('\nerror hygiene');
  const missing = await call('GET', '/organizations/does-not-exist-id');
  check('unknown organization is 404', missing.status === 404, `got ${missing.status}`);
  check('errors carry a correlationId', !!missing.json?.correlationId);
  const errText = JSON.stringify(missing.json ?? {});
  check('errors do not leak stack traces or file paths', !/\.ts:|node_modules|prisma\\|at Object\./.test(errText));

  // ------------------------------------------------------------ live data
  //
  // These hit third-party services (OpenStreetMap, Open-Meteo). Network flakes
  // are not our bug, so an upstream outage is reported as a skip rather than a
  // failure — but the contract that a *reachable* upstream must honour is
  // asserted strictly, especially that live facilities carry no availability.
  console.log('\nlive data (third-party)');
  const BLR = 'lat=12.9716&lng=77.5946';

  const env = await call('GET', `/live/environment?${BLR}`);
  check('GET /live/environment is public (no token)', env.status === 200, `got ${env.status}`);
  if (env.status === 200) {
    const d = env.json?.data ?? {};
    check('environment names the place it describes', typeof d.location === 'string' && d.location.length > 0);
    check('environment credits its sources', Array.isArray(d.sources) && d.sources.length > 0);
    if (d.airQuality) {
      // The number is US EPA AQI, not CPCB. Mislabelling it in the UI would be
      // a factual error, so the field name is asserted here.
      check('air quality is reported as usAqi', typeof d.airQuality.usAqi === 'number');
      check('air quality carries an observation time', typeof d.airQuality.observedAt === 'string');
    } else {
      console.log('  SKIP  air quality (upstream returned nothing)');
    }
    if (d.weather) {
      check('weather carries an observation time', typeof d.weather.observedAt === 'string');
    } else {
      console.log('  SKIP  weather (upstream returned nothing)');
    }
  }

  const facilities = await call('GET', `/live/facilities?${BLR}&radiusKm=3`);
  check('GET /live/facilities is public (no token)', facilities.status === 200, `got ${facilities.status}`);
  if (facilities.status === 200) {
    const d = facilities.json?.data ?? {};
    check('facilities carry OSM attribution (ODbL requires it)', /OpenStreetMap/i.test(d.attribution ?? ''));
    const list = Array.isArray(d.facilities) ? d.facilities : [];
    if (list.length === 0) {
      console.log('  SKIP  facility shape (Overpass returned nothing)');
    } else {
      check('facilities are sorted nearest-first', list.every((f, i) => i === 0 || f.distanceKm >= list[i - 1].distanceKm));
      check('every facility has an osmRef, not a CivicConnect id', list.every((f) => /^(node|way|relation)\//.test(f.osmRef ?? '')));
      // The core provenance guarantee: real places never carry invented stock.
      const availabilityKeys = ['availableBeds', 'availableIcuBeds', 'totalBeds', 'unitsAvailable', 'stock', 'quantity'];
      check(
        'live facilities expose NO availability figures',
        list.every((f) => availabilityKeys.every((k) => !(k in f))),
        'a real OSM place must never carry simulated availability',
      );
    }
  }

  const badLiveGeo = await call('GET', '/live/facilities?lat=999&lng=77.5946');
  check('out-of-range latitude is rejected', badLiveGeo.status === 400, `got ${badLiveGeo.status}`);

  // ---------------------------------------------------------------- logout
  console.log('\nlogout');
  const out = await call('POST', '/auth/logout', { token: session.tokens.accessToken });
  check('POST /auth/logout is 200', out.status === 200);
  const afterLogout = await call('POST', '/auth/refresh', { body: { refreshToken: rotated?.refreshToken } });
  check('the refresh token is dead after logout', afterLogout.status === 401, `got ${afterLogout.status}`);

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('\nSmoke test aborted:', err.message);
  console.error('Is the API running on', BASE, '?');
  process.exit(1);
});
