import http from 'node:http';
import https from 'node:https';
import { exec } from 'node:child_process';

const PORT = process.env.AI_PROXY_PORT ?? 3579;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';
const DEPLOY_TOKEN = process.env.DEPLOY_TOKEN ?? '';

const DEPLOY_ACTIONS = {
  deploy_dev: `sudo -u admin -H bash -lc '/home/admin/update-timesheet.sh'`,
  deploy_prod: `sudo -u admin -H bash -lc 'cd /home/admin/timesheet && ./deploy-prod.sh'`,
};

function runDeploy(action) {
  return new Promise((resolve, reject) => {
    const cmd = DEPLOY_ACTIONS[action];
    if (!cmd) return reject(new Error('Unknown action'));
    exec(cmd, { timeout: 120000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve(stdout);
    });
  });
}

const PROMPTS = {
  correct_fr: "Corrige l'orthographe, la grammaire et la ponctuation du texte suivant en français. Retourne uniquement le texte corrigé, sans explication.",
  rewrite_fr: "Réécris le texte suivant dans un style professionnel en français, adapté à un rapport technique d'événement. Retourne uniquement le texte réécrit, sans explication.",
  translate_en: "Translate the following French text to professional English. Return only the translated text, no explanation.",
  polish_incident_fr: `Tu reçois un objet JSON représentant un incident dans un rapport technique d'événement en français. Améliore le style, l'orthographe, la grammaire et la ponctuation de chaque champ fourni. Retourne UNIQUEMENT un objet JSON valide avec exactement les mêmes clés, sans aucune explication ni texte supplémentaire.`,
  polish_incident_en: `You receive a JSON object representing an incident in a technical event report in English. Improve the style, spelling, grammar, and punctuation of each provided field. Return ONLY a valid JSON object with exactly the same keys, no explanation or extra text.`,
};

const SCREENSHOT_SYSTEM_PROMPT = `You are analyzing a network monitoring screenshot from an event report. Extract data for the LAST FULLY VISIBLE hour block shown in the graph — not a partial/cut-off hour, not an average.

Rules:
- Identify the last complete hour interval visible (e.g. "14:00" if the range shown ends at 15:00).
- Extract the download value (bandwidth out) and upload value (bandwidth in) for that hour only.
- Values are typically in GB or MB — include the unit if visible.
- If the hour label is ambiguous or not clearly readable, set "uncertain": true.
- If a value is not readable, set it to null.

Return ONLY a valid JSON object with this exact shape:
{
  "hour_label": "HH:MM or null",
  "bandwidth_out": <number in GB or null>,
  "bandwidth_in": <number in GB or null>,
  "uncertain": <true or false>
}

No explanation. No extra text. Just the JSON object.`;

function makeScreenshotForHourPrompt(targetHour) {
  return `You are analyzing a network monitoring screenshot from an event report. The user has selected the hour "${targetHour}" as the target. Extract values FOR THAT SPECIFIC HOUR ONLY.

Rules:
- The target hour is explicitly "${targetHour}". Do NOT pick a different hour.
- Extract the download value (bandwidth out) and upload value (bandwidth in) for that hour only.
- Values are typically in GB or MB. Convert to GB if needed (e.g. 512 MB = 0.512 GB). Return a plain number.
- If the graph is unclear or the target hour is not readable, set "uncertain": true and return null for values you cannot read.
- Do NOT invent values. If unsure, prefer null over a guess.
- wifi_users: if clearly visible as a labeled user count for that hour, include it as an integer; otherwise return null.

Return ONLY a valid JSON object with this exact shape:
{
  "hour_label": "${targetHour}",
  "bandwidth_out": <number in GB or null>,
  "bandwidth_in": <number in GB or null>,
  "wifi_users": <integer or null>,
  "uncertain": <true or false>
}

No explanation. No extra text. Just the JSON object.`;
}

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

function callOpenAIVision(imageUrl) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 512,
      temperature: 0.1,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: SCREENSHOT_SYSTEM_PROMPT },
            { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } },
          ],
        },
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
    req.setTimeout(30000, () => {
      req.destroy(new Error('OpenAI vision request timed out'));
    });
    req.write(body);
    req.end();
  });
}

function callOpenAIVisionBase64(base64DataUri, targetHour) {
  const prompt = makeScreenshotForHourPrompt(targetHour);
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 512,
      temperature: 0.1,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: base64DataUri, detail: 'high' } },
          ],
        },
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
    req.setTimeout(30000, () => {
      req.destroy(new Error('OpenAI vision request timed out'));
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

  if (req.method === 'POST' && (req.url === '/deploy/dev' || req.url === '/deploy/prod')) {
    const token = req.headers['x-deploy-token'];
    if (!DEPLOY_TOKEN || token !== DEPLOY_TOKEN) {
      return json(res, 403, { error: 'Forbidden' });
    }
    const action = req.url === '/deploy/dev' ? 'deploy_dev' : 'deploy_prod';
    try {
      const output = await runDeploy(action);
      return json(res, 200, { ok: true, output });
    } catch (e) {
      return json(res, 500, { error: e instanceof Error ? e.message : 'Deploy failed' });
    }
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

    const { text: inputText, action, imageUrl, base64Image, targetHour } = parsed;

    if (action === 'analyze_screenshot_for_hour') {
      if (!base64Image?.trim()) return text(res, 400, 'base64Image is required');
      if (!targetHour?.trim()) return text(res, 400, 'targetHour is required');
      try {
        const result = await callOpenAIVisionBase64(base64Image, targetHour);
        const stripped = result.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
        return json(res, 200, JSON.parse(stripped));
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        return text(res, 502, msg);
      }
    }

    if (action === 'analyze_screenshot') {
      if (!imageUrl?.trim()) return text(res, 400, 'imageUrl is required');
      try {
        const result = await callOpenAIVision(imageUrl);
        const stripped = result.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
        return json(res, 200, JSON.parse(stripped));
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        return text(res, 502, msg);
      }
    }

    if (!inputText?.trim()) return text(res, 400, 'text is required');

    const systemPrompt = PROMPTS[action];
    if (!systemPrompt) return text(res, 400, 'invalid action');

    const isJsonAction = action === 'polish_incident_fr' || action === 'polish_incident_en';

    try {
      const result = await callOpenAI(systemPrompt, inputText);
      if (isJsonAction) {
        const stripped = result.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
        return json(res, 200, JSON.parse(stripped));
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
