// Comprehensive client-side Devanagari to Natural Romanized Hinglish transliterator
// Provides 0ms instant transliteration for Bollywood and Hindi lyrics

const consonants: Record<string, string> = {
  'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ng',
  'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'ny',
  'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
  'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
  'प': 'p', 'फ': 'f', 'ब': 'b', 'भ': 'bh', 'म': 'm',
  'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v',
  'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',
  'क़': 'q', 'ख़': 'kh', 'ग़': 'g', 'ज़': 'z', 'ड़': 'r', 'ढ़': 'rh', 'फ़': 'f',
};

const vowels: Record<string, string> = {
  'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo', 'ऋ': 'ri',
  'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au',
};

const matras: Record<string, string> = {
  'ा': 'a', 'ि': 'i', 'ी': 'i', 'ु': 'u', 'ू': 'u', 'ृ': 'ri',
  'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au',
};

const virama = '्';
const anusvara = 'ं';
const candrabindu = 'ँ';
const visarga = 'ः';
const nukta = '़';

const wordOverrides: Record<string, string> = {
  'है': 'hai', 'हैं': 'hain', 'हो': 'ho', 'हूँ': 'hoon', 'हूं': 'hoon',
  'था': 'tha', 'थी': 'thee', 'थे': 'the',
  'मैं': 'main', 'हम': 'hum', 'तुम': 'tum', 'तू': 'tu', 'आप': 'aap',
  'का': 'ka', 'की': 'ki', 'के': 'ke', 'को': 'ko', 'से': 'se', 'में': 'mein',
  'पर': 'par', 'तक': 'tak', 'और': 'aur', 'या': 'ya', 'भी': 'bhi',
  'नहीं': 'nahi', 'नही': 'nahi', 'ना': 'na', 'हाँ': 'haan', 'हां': 'haan',
  'प्यार': 'pyar', 'दिल': 'dil', 'जिंदगी': 'zindagi', 'ज़िंदगी': 'zindagi',
  'मोहब्बत': 'mohabbat', 'इश्क': 'ishq', 'यार': 'yaar', 'दोस्त': 'dost',
  'बात': 'baat', 'रात': 'raat', 'दिन': 'din', 'आंखें': 'aankhein', 'आँखें': 'aankhein',
  'चेहरा': 'chehra', 'तेरा': 'tera', 'मेरी': 'meri', 'मेरा': 'mera', 'मेरे': 'mere',
  'तुझे': 'tujhe', 'मुझे': 'mujhe', 'उसे': 'use', 'हमे': 'hume', 'हमें': 'humein',
  'जान': 'jaan', 'सनम': 'sanam', 'सafar': 'safar', 'सफर': 'safar', 'रास्ता': 'raasta', 'मंजिल': 'manzil',
  'खुदा': 'khuda', 'दुआ': 'dua', 'करूं': 'karoon', 'करूँ': 'karoon', 'करता': 'karta',
  'करती': 'karti', 'करते': 'karte', 'रहा': 'raha', 'रही': 'rahi', 'रहे': 'rahe',
  'नमस्ते': 'namaste', 'खुशी': 'khushi', 'गाना': 'gaana', 'गीत': 'geet',
  'आवाज': 'aawaaz', 'आवाज़': 'aawaaz', 'पास': 'paas', 'दूर': 'door', 'साथ': 'saath',
  'लाज़मी': 'laazmi', 'लाजमी': 'laazmi', 'पर्दा': 'parda', 'शादी': 'shaadi', 'तड़पा': 'tadpa',
  'मुश्किल': 'mushkil', 'कहो': 'kaho', 'चुप': 'chup', 'सामने': 'saamne', 'आया': 'aaya', 'जाय': 'jaaye',
  'करो': 'karo', 'अगर': 'agar', 'रहूँ': 'rahoon', 'रहूं': 'rahoon', 'बड़ी': 'badi', 'जाया': 'jaaya',
  'कैसे': 'kaise', 'किस': 'kis', 'किसने': 'kisne', 'क्यों': 'kyun', 'क्यूँ': 'kyun', 'कहाँ': 'kahaan', 'यहाँ': 'yahaan', 'वहाँ': 'wahaan',
};

export function hasDevanagari(text: string): boolean {
  if (!text) return false;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0x0900 && code <= 0x097f) {
      return true;
    }
  }
  return false;
}

export function devanagariToHinglish(text: string): string {
  if (!text || !hasDevanagari(text)) return '';

  const tokens = text.split(/(\s+|[.,!?:;""'()\[\]]+)/);
  let result = '';

  for (const tok of tokens) {
    if (!tok) continue;

    const trimmed = tok.trim();
    if (wordOverrides[trimmed]) {
      result += wordOverrides[trimmed];
      continue;
    }

    for (let i = 0; i < tok.length; i++) {
      const ch = tok[i];
      let next = i + 1 < tok.length ? tok[i + 1] : '';

      // Check nukta
      let charStr = ch;
      if (next === nukta) {
        charStr = ch + nukta;
        i++;
        next = i + 1 < tok.length ? tok[i + 1] : '';
      }

      if (vowels[ch]) {
        result += vowels[ch];
      } else if (consonants[charStr]) {
        const consStr = consonants[charStr];
        if (next === virama) {
          result += consStr;
          i++;
        } else if (matras[next]) {
          result += consStr + matras[next];
          i++;
        } else {
          // Schwa deletion logic
          const isAtEnd = i === tok.length - 1;
          const afterNext = i + 2 < tok.length ? tok[i + 2] : '';
          if (isAtEnd) {
            result += consStr;
          } else if (consonants[next] && (!afterNext || matras[afterNext])) {
            result += consStr;
          } else {
            result += consStr + 'a';
          }
        }
      } else if (matras[ch]) {
        result += matras[ch];
      } else if (ch === anusvara || ch === candrabindu) {
        result += 'n';
      } else if (ch === visarga) {
        result += 'h';
      } else {
        result += ch;
      }
    }
  }

  // Capitalize first letter of sentence cleanly
  const trimmed = result.trim();
  if (trimmed.length > 0) {
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  }
  return trimmed;
}
