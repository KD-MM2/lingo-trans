export type LanguageInfo = {
  code: string;
  english: string;
  chinese: string;
};

export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  { code: "zh", english: "Chinese", chinese: "中文" },
  { code: "en", english: "English", chinese: "英语" },
  { code: "fr", english: "French", chinese: "法语" },
  { code: "pt", english: "Portuguese", chinese: "葡萄牙语" },
  { code: "es", english: "Spanish", chinese: "西班牙语" },
  { code: "ja", english: "Japanese", chinese: "日语" },
  { code: "tr", english: "Turkish", chinese: "土耳其语" },
  { code: "ru", english: "Russian", chinese: "俄语" },
  { code: "ar", english: "Arabic", chinese: "阿拉伯语" },
  { code: "ko", english: "Korean", chinese: "韩语" },
  { code: "th", english: "Thai", chinese: "泰语" },
  { code: "it", english: "Italian", chinese: "意大利语" },
  { code: "de", english: "German", chinese: "德语" },
  { code: "vi", english: "Vietnamese", chinese: "越南语" },
  { code: "ms", english: "Malay", chinese: "马来语" },
  { code: "id", english: "Indonesian", chinese: "印尼语" },
  { code: "tl", english: "Filipino", chinese: "菲律宾语" },
  { code: "hi", english: "Hindi", chinese: "印地语" },
  { code: "zh-hant", english: "Traditional Chinese", chinese: "繁体中文" },
  { code: "pl", english: "Polish", chinese: "波兰语" },
  { code: "cs", english: "Czech", chinese: "捷克语" },
  { code: "nl", english: "Dutch", chinese: "荷兰语" },
  { code: "km", english: "Khmer", chinese: "高棉语" },
  { code: "my", english: "Burmese", chinese: "缅甸语" },
  { code: "fa", english: "Persian", chinese: "波斯语" },
  { code: "gu", english: "Gujarati", chinese: "古吉拉特语" },
  { code: "ur", english: "Urdu", chinese: "乌尔都语" },
  { code: "te", english: "Telugu", chinese: "泰卢固语" },
  { code: "mr", english: "Marathi", chinese: "马拉地语" },
  { code: "he", english: "Hebrew", chinese: "希伯来语" },
  { code: "bn", english: "Bengali", chinese: "孟加拉语" },
  { code: "ta", english: "Tamil", chinese: "泰米尔语" },
  { code: "uk", english: "Ukrainian", chinese: "乌克兰语" },
  { code: "bo", english: "Tibetan", chinese: "藏语" },
  { code: "kk", english: "Kazakh", chinese: "哈萨克语" },
  { code: "mn", english: "Mongolian", chinese: "蒙古语" },
  { code: "ug", english: "Uyghur", chinese: "维吾尔语" },
  { code: "yue", english: "Cantonese", chinese: "粤语" },
];

const LANGUAGE_LOOKUP = new Map<string, LanguageInfo>();

for (const info of SUPPORTED_LANGUAGES) {
  const englishKey = info.english.toLowerCase();
  LANGUAGE_LOOKUP.set(info.code.toLowerCase(), info);
  LANGUAGE_LOOKUP.set(englishKey, info);
  LANGUAGE_LOOKUP.set(info.chinese, info);
}

const CHINESE_LANGUAGE_CODES = new Set(["zh", "zh-hant", "yue"]);

export const defaultTranslateTemplate = `Translate the following segment into <target_language>, without additional explanation.

<source_text>`;

export const chineseTranslateTemplate = `把下面的文本翻译成<target_language>，不要额外解释。

<source_text>`;

export const defaultRewriteTemplate = `Rewrite the following <target_language> segment in a <tone> tone, preserving facts and meaning. No extra explanations.

<source_text>`;

function findLanguageInfo(value: string | undefined): LanguageInfo | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const lower = trimmed.toLowerCase();
  if (LANGUAGE_LOOKUP.has(lower)) return LANGUAGE_LOOKUP.get(lower);
  if (LANGUAGE_LOOKUP.has(trimmed)) return LANGUAGE_LOOKUP.get(trimmed);
  const normalized = lower.replace(/_/g, "-");
  if (LANGUAGE_LOOKUP.has(normalized)) return LANGUAGE_LOOKUP.get(normalized);
  const base = normalized.split("-")[0];
  if (LANGUAGE_LOOKUP.has(base)) return LANGUAGE_LOOKUP.get(base);
  return undefined;
}

export function resolveLanguageLabel(
  value: string,
  options?: { preferChineseName?: boolean }
): string {
  if (!value) return "";
  if (value === "auto") return options?.preferChineseName ? "自动" : "Auto";

  const info = findLanguageInfo(value);
  if (info) {
    if (options?.preferChineseName) return info.chinese;
    return info.english;
  }

  const normalized = value.replace(/[_-]/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) return value;
  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}

function isDefaultTranslateTemplate(value: string | undefined) {
  if (!value) return true;
  return value.trim() === defaultTranslateTemplate.trim();
}

export function isChineseLanguage(value: string | undefined) {
  const info = findLanguageInfo(value);
  if (!info) return false;
  return CHINESE_LANGUAGE_CODES.has(info.code.toLowerCase());
}

export function resolveTranslateTemplate(
  sourceLang: string | undefined,
  targetLang: string | undefined,
  currentTemplate?: string
) {
  if (currentTemplate && !isDefaultTranslateTemplate(currentTemplate)) {
    return currentTemplate;
  }

  if (isChineseLanguage(sourceLang) || isChineseLanguage(targetLang)) {
    return chineseTranslateTemplate;
  }

  return defaultTranslateTemplate;
}

export function compileTemplate(
  template: string,
  variables: Record<string, string>
) {
  return template.replace(
    /<([a-z_]+)>/gi,
    (_, key: string) => variables[key] ?? ""
  );
}
