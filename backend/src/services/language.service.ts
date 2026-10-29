import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/app-error.js';
import {
  EXCLUDED_LANGUAGE_CODES,
  findCatalogLanguage,
  LANGUAGE_CATALOG,
} from '../data/language-catalog.js';
import {
  TRANSLATION_CATALOG,
  TRANSLATION_KEYS,
  TRANSLATION_KEY_SET,
} from '../data/translation-keys.js';

const includeStatus = <
  T extends {
    code: string;
    translationCoverage: number;
    _count?: { translations: number };
    translations?: unknown[];
  },
>(
  language: T,
) => {
  const completed =
    language.code === 'en'
      ? TRANSLATION_KEYS.length
      : (language._count?.translations ??
        language.translations?.length ??
        Math.round((language.translationCoverage / 100) * TRANSLATION_KEYS.length));
  const translationCoverage = Math.round((completed / TRANSLATION_KEYS.length) * 100);
  const { _count, ...value } = language;
  return {
    ...value,
    translationCoverage,
    translationCompleted: completed,
    translationRequired: TRANSLATION_KEYS.length,
    translationMissing: Math.max(0, TRANSLATION_KEYS.length - completed),
    translationAvailable: translationCoverage >= 100,
    translationStatus: translationCoverage >= 100 ? 'AVAILABLE' : 'REQUIRED',
  };
};

const assertAllowed = (code: string) => {
  if (EXCLUDED_LANGUAGE_CODES.has(code.trim().toLowerCase()))
    throw new AppError(422, 'This language is not supported.', 'INVALID_LANGUAGE');
};

const configuredLanguage = async (identifier: string) => {
  const language = await prisma.language.findFirst({
    where: { OR: [{ id: identifier }, { code: identifier }] },
  });
  if (!language) throw new AppError(404, 'Configured language not found.', 'NOT_FOUND');
  assertAllowed(language.code);
  return language;
};

export const languageService = {
  async listEnabled() {
    return (
      await prisma.language.findMany({
        where: { enabled: true, code: { notIn: [...EXCLUDED_LANGUAGE_CODES] } },
        include: { translations: { select: { key: true, value: true } } },
        orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      })
    ).map(includeStatus);
  },
  async listAll() {
    return (
      await prisma.language.findMany({
        where: { code: { notIn: [...EXCLUDED_LANGUAGE_CODES] } },
        include: { _count: { select: { translations: true } } },
        orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      })
    ).map(includeStatus);
  },
  async catalog(search = '') {
    const query = search.trim().toLocaleLowerCase('en');
    return LANGUAGE_CATALOG.filter(
      (item) =>
        !query ||
        item.code.toLowerCase().includes(query) ||
        item.name.toLocaleLowerCase('en').includes(query) ||
        item.nativeName.toLocaleLowerCase().includes(query),
    );
  },
  async preference(userId: string) {
    const value = await prisma.userLanguagePreference.findUnique({
      where: { userId },
      include: { language: true },
    });
    if (value?.language?.enabled && !EXCLUDED_LANGUAGE_CODES.has(value.language.code.toLowerCase()))
      return includeStatus(value.language);
    const fallback = await prisma.language.findFirst({
      where: { isDefault: true, enabled: true, code: 'en' },
    });
    return fallback ? includeStatus(fallback) : null;
  },
  async select(userId: string, code: string) {
    assertAllowed(code);
    const language = await prisma.language.findUnique({ where: { code } });
    if (!language || !language.enabled)
      throw new AppError(422, 'This language is not enabled.', 'LANGUAGE_UNAVAILABLE');
    await prisma.userLanguagePreference.upsert({
      where: { userId },
      update: { languageId: language.id },
      create: { userId, languageId: language.id },
    });
    return includeStatus(language);
  },
  async add(code: string) {
    assertAllowed(code);
    const catalog = findCatalogLanguage(code);
    if (!catalog) throw new AppError(422, 'Choose a valid catalog language.', 'INVALID_LANGUAGE');
    const existing = await prisma.language.findUnique({ where: { code: catalog.code } });
    if (existing) throw new AppError(409, 'This language is already configured.', 'DUPLICATE');
    return includeStatus(
      await prisma.language.create({
        data: { ...catalog, enabled: false, isDefault: false, translationCoverage: 0 },
      }),
    );
  },
  async addMany(codes: string[]) {
    const uniqueCodes = [...new Set(codes.map((code) => code.trim()))];
    const catalog = uniqueCodes.map((code) => {
      assertAllowed(code);
      const item = findCatalogLanguage(code);
      if (!item) throw new AppError(422, `Language ${code} is not supported.`, 'INVALID_LANGUAGE');
      return item;
    });
    const existing = await prisma.language.findMany({
      where: { code: { in: catalog.map((item) => item.code) } },
      select: { code: true },
    });
    if (existing.length)
      throw new AppError(
        409,
        `Already configured: ${existing.map((item) => item.code).join(', ')}.`,
        'DUPLICATE',
      );
    return prisma.$transaction(
      catalog.map((item) =>
        prisma.language.create({
          data: { ...item, enabled: false, isDefault: false, translationCoverage: 0 },
        }),
      ),
    );
  },
  async update(identifier: string, values: { enabled?: boolean; isDefault?: boolean }) {
    const language = await configuredLanguage(identifier);
    if (values.enabled === false && language.isDefault)
      throw new AppError(
        409,
        'The default language cannot be disabled.',
        'DEFAULT_LANGUAGE_REQUIRED',
      );
    if (values.isDefault && language.translationCoverage < 100)
      throw new AppError(
        422,
        'This translation pack is incomplete and cannot be enabled or made default.',
        'TRANSLATION_INCOMPLETE',
      );
    return prisma.$transaction(async (tx) => {
      if (values.isDefault) await tx.language.updateMany({ data: { isDefault: false } });
      const updated = await tx.language.update({
        where: { id: language.id },
        data: {
          ...(values.enabled !== undefined ? { enabled: values.enabled } : {}),
          ...(values.isDefault !== undefined ? { isDefault: values.isDefault } : {}),
          ...(values.isDefault ? { enabled: true } : {}),
        },
      });
      return includeStatus(updated);
    });
  },
  async remove(identifier: string) {
    const language = await configuredLanguage(identifier);
    if (language.isDefault)
      throw new AppError(
        409,
        'The default language cannot be removed.',
        'DEFAULT_LANGUAGE_REQUIRED',
      );
    const fallback = await prisma.language.findFirst({
      where: { isDefault: true, enabled: true, translationCoverage: { gte: 100 } },
    });
    if (!fallback)
      throw new AppError(
        409,
        'A translated default language is required.',
        'DEFAULT_LANGUAGE_REQUIRED',
      );
    await prisma.$transaction([
      prisma.userLanguagePreference.updateMany({
        where: { languageId: language.id },
        data: { languageId: fallback.id },
      }),
      prisma.language.delete({ where: { id: language.id } }),
    ]);
  },
  async translations(identifier: string) {
    const configured = await configuredLanguage(identifier);
    const language = await prisma.language.findUnique({
      where: { id: configured.id },
      include: { translations: { select: { key: true, value: true } } },
    });
    if (!language) throw new AppError(404, 'Configured language not found.', 'NOT_FOUND');
    return {
      code: language.code,
      keys: TRANSLATION_KEYS,
      source: TRANSLATION_CATALOG,
      values: Object.fromEntries(language.translations.map((item) => [item.key, item.value])),
      totalKeys: TRANSLATION_KEYS.length,
      completedKeys: language.translations.length,
      missingKeys: TRANSLATION_KEYS.length - language.translations.length,
      translationCoverage: Math.round(
        (language.translations.length / TRANSLATION_KEYS.length) * 100,
      ),
    };
  },
  async saveTranslations(identifier: string, values: Record<string, string>) {
    const language = await configuredLanguage(identifier);
    if (language.code === 'en')
      throw new AppError(
        409,
        'English translations are maintained by the application.',
        'CONFLICT',
      );
    const entries = Object.entries(values).map(([key, value]) => [key, value.trim()] as const);
    const invalidKeys = entries
      .filter(([key]) => !TRANSLATION_KEY_SET.has(key))
      .map(([key]) => key);
    if (invalidKeys.length)
      throw new AppError(
        422,
        `Unknown translation key${invalidKeys.length === 1 ? '' : 's'}: ${invalidKeys.slice(0, 5).join(', ')}`,
        'INVALID_TRANSLATION_KEY',
      );
    const translatedEntries = entries.filter(([, value]) => value);
    const clearedKeys = entries.filter(([, value]) => !value).map(([key]) => key);
    const completed = await prisma.$transaction(async (tx) => {
      // The request is a partial update. Omitted keys are deliberately untouched.
      // The composite unique key makes each upsert idempotent and prevents duplicates.
      for (let offset = 0; offset < translatedEntries.length; offset += 100) {
        const batch = translatedEntries.slice(offset, offset + 100);
        await Promise.all(
          batch.map(([key, value]) =>
            tx.languageTranslation.upsert({
              where: { languageId_key: { languageId: language.id, key } },
              create: { languageId: language.id, key, value },
              update: { value },
            }),
          ),
        );
      }
      if (clearedKeys.length)
        await tx.languageTranslation.deleteMany({
          where: { languageId: language.id, key: { in: clearedKeys } },
        });
      const translated = await tx.languageTranslation.count({ where: { languageId: language.id } });
      await tx.language.update({
        where: { id: language.id },
        data: { translationCoverage: Math.round((translated / TRANSLATION_KEYS.length) * 100) },
      });
      return translated;
    });
    const result = await this.translations(language.id);
    return {
      ...result,
      updatedKeys: entries.map(([key]) => key),
      completedKeys: completed,
    };
  },
};
