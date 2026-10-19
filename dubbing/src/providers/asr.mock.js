// Mock ASR: returns a fixed transcript with timings.
// Real provider: swap in a managed ASR (env ASR_PROVIDER) behind the same shape.
export const name = 'asr.mock';

export async function transcribe({ sourceLang }) {
  const lines = {
    hi: ['नमस्ते दोस्तों, आज हम यह सीखेंगे।', 'पहला कदम यह है कि ध्यान से देखें।', 'अंत में, धन्यवाद!'],
    en: ['Hello friends, today we will learn this.', 'The first step is to watch closely.', 'Finally, thank you!'],
  };
  const text = lines[sourceLang] || lines.en;
  return text.map((t, i) => ({ start: i * 4, end: i * 4 + 3.6, text: t }));
}
