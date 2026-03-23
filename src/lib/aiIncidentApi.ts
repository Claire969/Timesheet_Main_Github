export type AiAction = 'correct_fr' | 'rewrite_fr' | 'translate_en';

export async function aiAssistIncident(text: string, action: AiAction): Promise<string> {
  const res = await fetch('/ai-assist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, action }),
  });

  const body = await res.text();
  if (!res.ok) throw new Error(body || `HTTP ${res.status}`);
  return body;
}
