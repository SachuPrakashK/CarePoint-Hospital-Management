export interface LanguageCatalogEntry {
  code: string;
  name: string;
  nativeName: string;
}

// ISO 639-1 language identifiers plus commonly deployed IANA BCP 47 script/region variants.
// Display names come from the Unicode CLDR data bundled with Node.js Intl.DisplayNames.
const ISO_639_1_CODES =
  `aa ab ae af ak am an ar as av ay az ba be bg bh bi bm bn bo br bs ca ce ch co cr cs cu cv cy da de dv dz ee el en eo es et eu fa ff fi fj fo fr fy ga gd gl gn gu gv ha he hi ho hr ht hu hy hz ia id ie ig ii ik in io is it iu ja jv ka kg ki kj kk kl km kn ko kr ks ku kv kw ky la lb lg li ln lo lt lu lv mg mh mi mk ml mn mr ms mt my na nb nd ne ng nl nn no nr nv ny oc oj om or os pa pi pl ps pt qu rm rn ro ru rw sa sc sd se sg si sk sl sm sn so sq sr ss st su sv sw ta te tg th ti tk tl tn to tr ts tt tw ty ug uk ur uz ve vi vo wa wo xh yi yo za zh zu`.split(
    ' ',
  );

export const EXCLUDED_LANGUAGE_CODES = new Set(['hi', 'ml', 'ta']);

const VARIANTS = [
  'ar-EG',
  'ar-SA',
  'de-AT',
  'de-CH',
  'en-AU',
  'en-CA',
  'en-GB',
  'en-IN',
  'en-US',
  'es-419',
  'es-ES',
  'es-MX',
  'fr-CA',
  'fr-FR',
  'pt-BR',
  'pt-PT',
  'sr-Cyrl',
  'sr-Latn',
  'zh-Hans',
  'zh-Hant',
] as const;

const canonicalCodes = [...new Set([...ISO_639_1_CODES, ...VARIANTS])]
  .map((code) => Intl.getCanonicalLocales(code)[0])
  .filter((code): code is string => Boolean(code))
  .filter((code) => !EXCLUDED_LANGUAGE_CODES.has(code.toLowerCase()));

const englishNames = new Intl.DisplayNames(['en'], { type: 'language' });
const preferredEnglishNames: Record<string, string> = {
  'zh-Hans': 'Chinese (Simplified)',
  'zh-Hant': 'Chinese (Traditional)',
};

const entryFor = (code: string): LanguageCatalogEntry => {
  const name = preferredEnglishNames[code] ?? englishNames.of(code) ?? code;
  let nativeName = name;
  try {
    nativeName = new Intl.DisplayNames([code], { type: 'language' }).of(code) ?? name;
  } catch {
    // Some minimal ICU builds may not include every locale; English remains a safe label.
  }
  return { code, name, nativeName };
};

export const LANGUAGE_CATALOG = canonicalCodes
  .map(entryFor)
  .sort((left, right) => left.name.localeCompare(right.name, 'en'));

export const LANGUAGE_CATALOG_BY_CODE = new Map(
  LANGUAGE_CATALOG.map((entry) => [entry.code.toLowerCase(), entry]),
);

export const findCatalogLanguage = (value: string) => {
  try {
    const code = Intl.getCanonicalLocales(value.trim())[0];
    return code ? LANGUAGE_CATALOG_BY_CODE.get(code.toLowerCase()) : undefined;
  } catch {
    return undefined;
  }
};
