import 'dotenv/config';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
const testCodes = ['af', 'sq'];
for (const code of testCodes)
  assert.equal(
    before.body.data.some((item) => item.code === code),
    false,
  );

const added = await call('/languages/batch', {
  method: 'POST',
  headers,
  body: JSON.stringify({ codes: testCodes }),
});
assert.equal(added.response.status, 201);
const [language, secondLanguage] = added.body.data;
assert.ok(language.id && secondLanguage.id);

try {
  for (const item of [language, secondLanguage]) {
    const enabled = await call(`/languages/${item.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ enabled: true }),
    });
    assert.equal(enabled.response.status, 200);
  }

  const empty = await call(`/languages/${language.id}/translations`, { headers });
  assert.equal(empty.response.status, 200);
  assert.ok(empty.body.data.keys.length > 0);
  assert.deepEqual(empty.body.data.values, {});

  const firstKey = empty.body.data.keys[0];
  const sharedKey = empty.body.data.keys.includes('common.save') ? 'common.save' : firstKey;
  const batch = Object.fromEntries(
    empty.body.data.keys.slice(0, 600).map((key, index) => [key, `E2E translation ${index}`]),
  );
  batch[sharedKey] = 'Enregistrer';
  const saved = await call(`/languages/${language.id}/translations`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ values: batch }),
  });
  assert.equal(saved.response.status, 200);
  assert.equal(saved.body.data.values[sharedKey], 'Enregistrer');
  assert.equal(saved.body.data.completedKeys, 600);

  const reopened = await call(`/languages/${language.id}/translations`, { headers });
  assert.equal(reopened.response.status, 200);
  assert.equal(reopened.body.data.values[sharedKey], 'Enregistrer');
  const persisted = await prisma.languageTranslation.findUnique({
    where: { languageId_key: { languageId: language.id, key: sharedKey } },
  });
  assert.equal(persisted?.value, 'Enregistrer');

  const preservedKey = Object.keys(batch).find((key) => key !== sharedKey);
  assert.ok(preservedKey);
  const preservedValue = reopened.body.data.values[preservedKey];
  const updated = await call(`/languages/${language.id}/translations`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ values: { [sharedKey]: 'Sauvegarder' } }),
  });
  assert.equal(updated.response.status, 200);
  assert.deepEqual(updated.body.data.updatedKeys, [sharedKey]);
  assert.equal(updated.body.data.completedKeys, 600);
  const reopenedAfterUpdate = await call(`/languages/${language.id}/translations`, { headers });
  assert.equal(reopenedAfterUpdate.body.data.values[sharedKey], 'Sauvegarder');
  assert.equal(reopenedAfterUpdate.body.data.values[preservedKey], preservedValue);
  assert.equal(Object.keys(reopenedAfterUpdate.body.data.values).length, 600);
  const updatedRows = await prisma.languageTranslation.findMany({
    where: { languageId: language.id, key: sharedKey },
  });
  assert.equal(updatedRows.length, 1);
  assert.equal(updatedRows[0].value, 'Sauvegarder');

  const secondSaved = await call(`/languages/${secondLanguage.id}/translations`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ values: { [sharedKey]: 'Ruaj' } }),
  });
  assert.equal(secondSaved.response.status, 200);
  assert.equal(secondSaved.body.data.values[sharedKey], 'Ruaj');
  const isolated = await call(`/languages/${language.id}/translations`, { headers });
  assert.equal(isolated.body.data.values[sharedKey], 'Sauvegarder');

  const preference = await call('/languages/preference', {
    method: 'PUT',
    headers,
    body: JSON.stringify({ code: language.code }),
  });
  assert.equal(preference.response.status, 200);
  const runtime = await call('/languages', { headers });
  assert.equal(runtime.response.status, 200);
  const runtimeLanguage = runtime.body.data.find((item) => item.id === language.id);
  assert.equal(
    runtimeLanguage.translations.find((item) => item.key === sharedKey).value,
    'Sauvegarder',
  );

  const unauthorizedToken = jwt.sign(
    { sub: 'language-e2e', sid: 'language-e2e', permissions: ['settings.update'], roles: [] },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: '5m' },
  );
  const unauthorized = await call(`/languages/${language.id}/translations`, {
    headers: { authorization: `Bearer ${unauthorizedToken}` },
  });
  assert.equal(unauthorized.response.status, 403);
  const invalidLanguage = await call('/languages/not-a-real-language-id/translations', {
    method: 'PUT',
    headers,
    body: JSON.stringify({ values: { [sharedKey]: 'Invalid' } }),
  });
  assert.equal(invalidLanguage.response.status, 404);
  const invalidKey = await call(`/languages/${language.id}/translations`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ values: { 'not.a.registered.key': 'Invalid' } }),
  });
  assert.equal(invalidKey.response.status, 422);
  assert.equal(invalidKey.body.code, 'INVALID_TRANSLATION_KEY');
} finally {
  for (const item of [secondLanguage, language]) {
    const removed = await call(`/languages/${item.id}`, { method: 'DELETE', headers });
    assert.equal(removed.response.status, 204);
  }
}

const after = await call('/languages/configuration', { headers });
assert.equal(after.response.status, 200);
assert.equal(
  after.body.data.some((item) => [language.id, secondLanguage.id].includes(item.id)),
  false,
);
const catalog = await call('/languages/catalog', { headers });
assert.equal(catalog.response.status, 200);
for (const code of testCodes) assert.ok(catalog.body.data.some((item) => item.code === code));
await prisma.$disconnect();

console.log(
  JSON.stringify({
    idBasedOperations: true,
    emptyTranslationsLoaded: true,
    translationsPersisted: true,
    savedTranslationsReopened: true,
    translationsUpdated: true,
    languagesIsolated: true,
    runtimeDictionaryContainsSavedValues: true,
    unauthorizedRejected: true,
    invalidLanguageRejected: true,
    invalidTranslationKeyRejected: true,
    databaseRowVerified: true,
    duplicateRowsPrevented: true,
    omittedTranslationsPreserved: true,
    removedAndAvailableForReAdd: true,
  }),
);
