let API_KEY = localStorage.getItem('jarvis_key');

if (!API_KEY) {
  API_KEY = prompt('Enter your Gemini API Key:');
  if (API_KEY) localStorage.setItem('jarvis_key', API_KEY);
}

const MODELS = ["gemini-3.6-flash", "gemini-flash-latest"];

const chat = document.getElementById('chat');
const input = document.getElementById('msg');
const micBtn = document.getElementById('mic-btn');
// 🧠 J.A.R.V.I.S MEMORY

let memory = JSON.parse(
  localStorage.getItem('jarvis_memory') || '[]'
);

function saveMemory(text) {
  memory.push(text);

  localStorage.setItem(
    'jarvis_memory',
    JSON.stringify(memory)
  );

  console.log("MEMORY SAVED:", memory);
}

function getMemory() {
  return memory.join('\n');
}

async function callGemini(promptText) {
  let lastErr;

  for (const model of MODELS) {
    try {
      const res = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/" +
        model + ":generateContent?key=" + API_KEY,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: promptText
                  }
                ]
              }
            ]
          })
        }
      );

      const data = await res.json();

      if (data.error) {
        lastErr = new Error(data.error.message);

        if (/high demand|temporar|quota|rate|unavailable|no longer available|deprecated/i.test(data.error.message)) {
          continue;
        }

        throw lastErr;
      }

      return data.candidates[0].content.parts[0].text;

    } catch (e) {
      lastErr = e;
    }
  }

  throw lastErr;
}

async function askGemini(promptText) {
  add('J.A.R.V.I.S: Thinking...', 'ai');

  try {
    const memoryText = getMemory();

    const fullPrompt =
      "You are J.A.R.V.I.S. Use the following memory when relevant:\n" +
      memoryText +
      "\n\nUser: " +
      promptText;

    const reply = await callGemini(fullPrompt);

    chat.lastChild.innerText =
      'J.A.R.V.I.S: ' + reply;

    speak(reply);

    saveMemory("User: " + promptText);
    saveMemory("J.A.R.V.I.S: " + reply);

  } catch (e) {
    chat.lastChild.innerText =
      'J.A.R.V.I.S: ERROR - ' + e.message;
  }
}


// 🎤 VOICE INPUT

const SR =
  window.SpeechRecognition ||
  window.webkitSpeechRecognition;

const rec = new SR();

rec.lang = 'en-US';

rec.onresult = (e) => {
  const text = e.results[0][0].transcript;

  add('YOU: ' + text, 'user');

  askGemini(text);
};

micBtn.onclick = () => {
  rec.start();
  micBtn.innerText = 'LISTENING...';
};

rec.onend = () => {
  micBtn.innerText = '🎤';
};


// 🔊 VOICE OUTPUT

let voices = [];

function loadVoices() {
  voices = speechSynthesis.getVoices();
}

loadVoices();

speechSynthesis.onvoiceschanged = loadVoices;

function speak(text) {
  const utterance =
    new SpeechSynthesisUtterance(text);

  utterance.rate = 1.05;
  utterance.pitch = 0.85;

  const voice =
    voices.find(v => v.lang.startsWith('en'));

  if (voice) {
    utterance.voice = voice;
  }

  speechSynthesis.speak(utterance);
}


// ⌨️ TEXT SEND

document.getElementById('send').onclick = () => {
  const text = input.value.trim();

  if (!text) return;

  add('YOU: ' + text, 'user');

  input.value = '';

  askGemini(text);
};


// 💬 ADD MESSAGE

function add(text, who) {
  const d = document.createElement('div');

  d.className = 'msg ' + who;

  d.innerText = text;

  chat.appendChild(d);

  chat.scrollTop = chat.scrollHeight;
}
// 🧠 CLEAR MEMORY

document.getElementById('clear-memory').onclick = () => {
  memory = [];

  localStorage.removeItem('jarvis_memory');

  add('J.A.R.V.I.S: Memory cleared.', 'ai');
};
// ===== TOOLS (THE HANDS) =====

async function handleTools(text) {
  const t = text.toLowerCase();

  // 1. Time
  if (/\btime\b/.test(t) || t.includes('సమయం')) {
    return 'The time is ' + new Date().toLocaleTimeString() + ', Boss.';
  }

  // 2. Weather
  if (t.includes('weather') || t.includes('వాతావరణం')) {
    return await new Promise(resolve => {
      navigator.geolocation.getCurrentPosition(async position => {
        try {
          const r = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${position.coords.latitude}&longitude=${position.coords.longitude}&current_weather=true`
          );

          const d = await r.json();

          resolve(
            `It is ${d.current_weather.temperature} degrees Celsius now, Boss.`
          );
        } catch (e) {
          resolve('Weather service error, Boss.');
        }
      }, () => {
        resolve('I need location permission for weather, Boss.');
      });
    });
  }

  // 3. Timer
  const match = t.match(
    /(\d+)\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)/i
  );

  if ((t.includes('timer') || t.includes('టైమర్')) && match) {
    const amount = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    const factor =
      /^(hours?|hrs?|h)/.test(unit)
        ? 3600000
        : /^(seconds?|secs?|s)/.test(unit)
        ? 1000
        : 60000;

    const duration = amount * factor;

    setTimeout(() => {
      speak(`Timer complete! ${amount} ${unit} finished.`);
    }, duration);

    return `Timer set for ${amount} ${unit}.`;
  }

  // 4. Translate
  if (t.includes('translate')) {
    const q =
      text.replace(/translate (this )?/i, '').trim() || 'hello';

    try {
      const r = await fetch(
        'https://api.mymemory.translated.net/get?q=' +
        encodeURIComponent(q) +
        '&langpair=en|te'
      );

      const d = await r.json();

      return 'In Telugu: ' + d.responseData.translatedText;
    } catch (e) {
      return 'Translate error, Boss.';
    }
  }

  // 5. YouTube Play
  if (t.includes('play ') || t.includes('youtube ')) {
    const q = text
      .replace(/play |youtube (search )?/i, '')
      .trim();

    if (q) {
      window.open(
        'https://www.youtube.com/results?search_query=' +
        encodeURIComponent(q)
      );

      return 'Searching YouTube for ' + q + ', Boss.';
    }
  }

  return null;
}
