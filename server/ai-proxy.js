import http from 'node:http';
import https from 'node:https';

const PORT = process.env.AI_PROXY_PORT ?? 3579;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';

const PROMPTS = {
  correct_fr: "Corrige l'orthographe, la grammaire et la ponctuation du texte suivant en français. Retourne uniquement le texte corrigé, sans explication.",
  rewrite_fr: "Réécris le texte suivant dans un style professionnel en français, adapté à un rapport technique d'événement. Retourne uniquement le texte réécrit, sans explication.",
  translate_en: "Translate the following French text to professional English. Return only the translated text, no explanation.",
  polish_incident_fr: `Tu reçois un objet JSON représentant un incident dans un rapport technique d'événement en français. Améliore le style, l'orthographe, la grammaire et la ponctuation de chaque champ fourni. Retourne UNIQUEMENT un objet JSON valide avec exactement les mêmes clés, sans aucune explication ni texte supplémentaire.`,
  polish_incident_en: `You receive a JSON object representing an incident in a technical event report in English. Improve the style, spelling, grammar, and punctuation of each provided field. Return ONLY a valid JSON object with exactly the same keys, no explanation or extra text.`,
};

function json(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(body);
}

function text(res, status, str) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(str);
}

function addCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function callOpenAI(systemPrompt, userText) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 1024,
      temperature: 0.3,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userText.slice(0, 4000) },
      ],
    });

    const req = https.request(
      {
        hostname: 'api.openai.com',
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode !== 200) {
            return reject(new Error(`OpenAI error ${res.statusCode}: ${data}`));
          }
          try {
            const parsed = JSON.parse(data);
            resolve(parsed.choices?.[0]?.message?.content?.trim() ?? '');
          } catch {
            reject(new Error('Failed to parse OpenAI response'));
          }
        });
      }
    );

    req.on('error', reject);
    req.setTimeout(20000, () => {
      req.destroy(new Error('OpenAI request timed out'));
    });
    req.write(body);
    req.end();
  });
}

const server = http.createServer(async (req, res) => {
  addCors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'POST' || req.url !== '/ai-assist') {
    return text(res, 404, 'Not found');
  }

  if (!OPENAI_API_KEY) {
    return text(res, 500, 'OPENAI_API_KEY not set');
  }

  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', async () => {
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      return text(res, 400, 'Invalid JSON');
    }

    const { text: inputText, action } = parsed;
    if (!inputText?.trim()) return text(res, 400, 'text is required');

    const systemPrompt = PROMPTS[action];
    if (!systemPrompt) return text(res, 400, 'invalid action');

    const isJsonAction = action === 'polish_incident_fr' || action === 'polish_incident_en';

    try {
      const result = await callOpenAI(systemPrompt, inputText);
      if (isJsonAction) {
        return json(res, 200, JSON.parse(result));
      }
      return text(res, 200, result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      return text(res, 502, msg);
    }
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`AI proxy listening on http://127.0.0.1:${PORT}`);
});
