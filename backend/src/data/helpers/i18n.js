'use strict';

// Resolves a localizable field. Plain strings pass through unchanged.
// Objects must have shape { en: '...', tr: '...' }.
function getLocalizedField(field, lang = 'en') {
  if (!field || typeof field !== 'object') return field ?? '';
  return field[lang] ?? field['en'] ?? '';
}

// Resolves all localizable fields in a content object and maps them to their
// DB column names. fieldMap format: { dataKey: 'db_column_name' }.
// Non-listed keys are copied as-is.
function resolveContent(obj, fieldMap, lang = 'en') {
  const result = { ...obj };
  for (const [field, col] of Object.entries(fieldMap)) {
    result[col] = getLocalizedField(obj[field], lang);
    if (field !== col) delete result[field];
  }
  return result;
}

module.exports = { getLocalizedField, resolveContent };
