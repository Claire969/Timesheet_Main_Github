export type AiAction = 'correct_fr' | 'rewrite_fr' | 'translate_en';

export async function aiAssistIncident(text: string, action: AiAction): Promise<string> {
  const proxyUrl = import.meta.env.VITE_AI_PROXY_URL;
  if (!proxyUrl) throw new Error('AI proxy not configured (VITE_AI_PROXY_URL missing)');

  const res = await fetch(`${proxyUrl}/ai-assist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, action }),
  });

  const body = await res.text();
  if (!res.ok) throw new Error(body || `HTTP ${res.status}`);
  return body;
}
