import 'dotenv/config';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

const api = `http://localhost:${process.env.PORT || 3000}/api/v1`;
const call = async (path, options = {}) => {
  const response = await fetch(`${api}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...options.headers },
  });
  return { response, body: await response.json().catch(() => null) };
};

const login = await call('/auth/login', {
  method: 'POST',
  body: JSON.stringify({
    email: process.env.SEED_HOSPITAL_ADMIN_EMAIL,
    password: process.env.SEED_HOSPITAL_ADMIN_PASSWORD,
  }),
});
assert.equal(login.response.status, 200);
const headers = { authorization: `Bearer ${login.body.data.access_token}` };

const before = await call('/languages/configuration', { headers });
assert.equal(before.response.status, 200);
const testCode = 'af';
assert.equal(
  before.body.data.some((item) => item.code === testCode),
  false,
);

const added = await call('/languages', {
  method: 'POST',
  headers,
  body: JSON.stringify({ code: testCode }),
});
assert.equal(added.response.status, 201);
const language = added.body.data;
assert.ok(language.id);

try {
  const enabled = await call(`/languages/${language.id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ enabled: true }),
  });
  assert.equal(enabled.response.status, 200);

  const empty = await call(`/languages/${language.id}/translations`, { headers });
  assert.equal(empty.response.status, 200);
  assert.ok(empty.body.data.keys.length > 0);
  assert.deepEqual(empty.body.data.values, {});

  const firstKey = empty.body.data.keys[0];
  const saved = await call(`/languages/${language.id}/translations`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ values: { [firstKey]: 'Toets' } }),
  });
  assert.equal(saved.response.status, 200);
  assert.equal(saved.body.data.values[firstKey], 'Toets');

  const unauthorizedToken = jwt.sign(
    { sub: 'language-e2e', sid: 'language-e2e', permissions: ['settings.update'], roles: [] },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: '5m' },
  );
  const unauthorized = await call(`/languages/${language.id}/translations`, {
    headers: { authorization: `Bearer ${unauthorizedToken}` },
  });
  assert.equal(unauthorized.response.status, 403);
} finally {
  const removed = await call(`/languages/${language.id}`, { method: 'DELETE', headers });
  assert.equal(removed.response.status, 204);
}

const after = await call('/languages/configuration', { headers });
assert.equal(after.response.status, 200);
assert.equal(
  after.body.data.some((item) => item.id === language.id),
  false,
);
const catalog = await call('/languages/catalog', { headers });
assert.equal(catalog.response.status, 200);
assert.ok(catalog.body.data.some((item) => item.code === testCode));

console.log(
  JSON.stringify({
    idBasedOperations: true,
    emptyTranslationsLoaded: true,
    translationsPersisted: true,
    unauthorizedRejected: true,
    removedAndAvailableForReAdd: true,
  }),
);
