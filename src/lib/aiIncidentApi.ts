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

export interface IncidentPolishFields {
  title?: string;
  description?: string;
  resolution?: string;
  network_impact_text?: string;
}

export async function aiPolishIncident(
  fields: IncidentPolishFields,
  language: 'fr' | 'en',
): Promise<IncidentPolishFields> {
  const action = language === 'en' ? 'polish_incident_en' : 'polish_incident_fr';
  const res = await fetch('/ai-assist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: JSON.stringify(fields), action }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `HTTP ${res.status}`);
  }
  return res.json() as Promise<IncidentPolishFields>;
}

export interface ScreenshotAnalysisResult {
  hour_label: string | null;
  bandwidth_out: number | null;
  bandwidth_in: number | null;
  uncertain: boolean;
}

export async function aiAnalyzeScreenshot(imageUrl: string): Promise<ScreenshotAnalysisResult> {
  const res = await fetch('/ai-assist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'analyze_screenshot', imageUrl }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `HTTP ${res.status}`);
  }
  return res.json() as Promise<ScreenshotAnalysisResult>;
}
