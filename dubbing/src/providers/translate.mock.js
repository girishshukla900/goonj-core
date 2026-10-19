// Mock translator: tags each segment with the target language and a marker.
// Real provider: swap in a translation API (env TRANSLATE_PROVIDER).
export const name = 'translate.mock';

const GREETING = {
  ta: 'வணக்கம் நண்பர்களே,', bn: 'নমস্কার বন্ধুরা,', te: 'నమస్తే మిత్రులారా,',
  mr: 'नमस्कार मित्रांनो,', pa: 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ ਦੋਸਤੋ,', kn: 'ನಮಸ್ಕಾರ ಗೆಳೆಯರೇ,',
  bho: 'प्रणाम भाई लोग,', hi: 'नमस्ते दोस्तों,', en: 'Hello friends,',
};

export async function translate({ segments, targetLang }) {
  return segments.map((s, i) => ({
    start: s.start,
    end: s.end,
    text: i === 0 ? `${GREETING[targetLang] || GREETING.en} [${targetLang}] ${s.text}`
                  : `[${targetLang}] ${s.text}`,
  }));
}
