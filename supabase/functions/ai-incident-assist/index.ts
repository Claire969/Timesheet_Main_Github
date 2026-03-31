import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const PROMPTS: Record<string, string> = {
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

function makeScreenshotForHourPrompt(targetHour: string): string {
  return `You are analyzing a network monitoring screenshot from an event report. The user has selected the hour "${targetHour}" as the target. Extract values FOR THAT SPECIFIC HOUR ONLY.

Rules:
- The target hour is explicitly "${targetHour}". Do NOT pick a different hour.
- Extract the download value (bandwidth out) and upload value (bandwidth in) for that hour only.
- Return the RAW numeric value exactly as shown on screen, and the EXACT unit string as shown (e.g. "Mbps", "MB/s", "GB", "MB", "Kb/s", "Gbps", "KB/s", "GB/s").
- Do NOT convert units yourself. Return the number and unit separately.
- If the graph is unclear or the target hour is not readable, set "uncertain": true and return null for values you cannot read.
- Do NOT invent values. If unsure, prefer null over a guess.
- wifi_users: if clearly visible as a labeled user count for that hour, include it as an integer; otherwise return null.

Return ONLY a valid JSON object with this exact shape:
{
  "hour_label": "${targetHour}",
  "bandwidth_out_raw": <number as shown on screen or null>,
  "bandwidth_out_unit": "<unit string as shown or null>",
  "bandwidth_in_raw": <number as shown on screen or null>,
  "bandwidth_in_unit": "<unit string as shown or null>",
  "wifi_users": <integer or null>,
  "uncertain": <true or false>
}

No explanation. No extra text. Just the JSON object.`;
}

function normalizeToGB(raw: number | null | undefined, unit: string | null | undefined): { gb: number | null; uncertain: boolean } {
  if (raw == null || raw === undefined) return { gb: null, uncertain: false };
  if (!unit) return { gb: null, uncertain: true };

  const u = unit.trim();

  const ratePatternsFull: Array<[RegExp, number]> = [
    [/^GB\/s$/i, 3600],
    [/^MB\/s$/i, 3600 / 1000],
    [/^KB\/s$/i, 3600 / 1_000_000],
    [/^Gbps$/i, 3600 / 8],
    [/^Mbps$/i, 3600 / 8 / 1000],
    [/^[Kk]bps$/i, 3600 / 8 / 1_000_000],
    [/^Gb\/s$/i, 3600 / 8],
    [/^Mb\/s$/i, 3600 / 8 / 1000],
    [/^[Kk]b\/s$/i, 3600 / 8 / 1_000_000],
  ];

  for (const [re, factor] of ratePatternsFull) {
    if (re.test(u)) {
      const gb = parseFloat((raw * factor).toFixed(2));
      return { gb, uncertain: false };
    }
  }

  const volumePatterns: Array<[RegExp, number]> = [
    [/^GB$/i, 1],
    [/^MB$/i, 1 / 1000],
    [/^[Kk]B$/i, 1 / 1_000_000],
    [/^[Gg]b$/i, 1 / 8],
    [/^[Mm]b$/i, 1 / 8 / 1000],
    [/^[Kk]b$/i, 1 / 8 / 1_000_000],
  ];

  for (const [re, factor] of volumePatterns) {
    if (re.test(u)) {
      const gb = parseFloat((raw * factor).toFixed(2));
      return { gb, uncertain: false };
    }
  }

  return { gb: null, uncertain: true };
}

const JSON_ACTIONS = new Set(["polish_incident_fr", "polish_incident_en", "analyze_screenshot", "analyze_screenshot_for_hour"]);

function unauthorized() {
  return new Response("Unauthorized", {
    status: 401,
    headers: corsHeaders,
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return unauthorized();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user?.id) return unauthorized();

  try {
    const body = await req.json() as { text?: string; action: string; imageUrl?: string; base64Image?: string; targetHour?: string };
    const { action, imageUrl, base64Image, targetHour } = body;
    const text = body.text;

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      return new Response("OpenAI not configured", { status: 500, headers: corsHeaders });
    }

    if (action === "analyze_screenshot_for_hour") {
      if (!base64Image?.trim()) {
        return new Response("base64Image is required", { status: 400, headers: corsHeaders });
      }
      if (!targetHour?.trim()) {
        return new Response("targetHour is required", { status: 400, headers: corsHeaders });
      }

      const prompt = makeScreenshotForHourPrompt(targetHour);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      let openaiRes: Response;
      try {
        openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o",
            max_tokens: 512,
            temperature: 0.1,
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: prompt },
                  { type: "image_url", image_url: { url: base64Image, detail: "high" } },
                ],
              },
            ],
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!openaiRes.ok) {
        return new Response(`OpenAI error: ${openaiRes.status}`, { status: 502, headers: corsHeaders });
      }

      const data = await openaiRes.json() as { choices: { message: { content: string } }[] };
      const result = (data.choices?.[0]?.message?.content?.trim() ?? "")
        .replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(result) as Record<string, unknown>;
      } catch {
        return new Response("Invalid JSON from AI", { status: 502, headers: corsHeaders });
      }

      const outNorm = normalizeToGB(
        parsed.bandwidth_out_raw as number | null,
        parsed.bandwidth_out_unit as string | null,
      );
      const inNorm = normalizeToGB(
        parsed.bandwidth_in_raw as number | null,
        parsed.bandwidth_in_unit as string | null,
      );

      const normalized = {
        hour_label: parsed.hour_label as string,
        bandwidth_out: outNorm.gb,
        bandwidth_in: inNorm.gb,
        wifi_users: parsed.wifi_users as number | null ?? null,
        uncertain: !!(parsed.uncertain) || outNorm.uncertain || inNorm.uncertain,
      };

      return new Response(JSON.stringify(normalized), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "analyze_screenshot") {
      if (!imageUrl?.trim()) {
        return new Response("imageUrl is required", { status: 400, headers: corsHeaders });
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      let openaiRes: Response;
      try {
        openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o",
            max_tokens: 512,
            temperature: 0.1,
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: SCREENSHOT_SYSTEM_PROMPT },
                  { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
                ],
              },
            ],
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!openaiRes.ok) {
        return new Response(`OpenAI error: ${openaiRes.status}`, { status: 502, headers: corsHeaders });
      }

      const data = await openaiRes.json() as { choices: { message: { content: string } }[] };
      const result = (data.choices?.[0]?.message?.content?.trim() ?? "")
        .replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();

      let parsed: unknown;
      try {
        parsed = JSON.parse(result);
      } catch {
        return new Response("Invalid JSON from AI", { status: 502, headers: corsHeaders });
      }
      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!text?.trim()) {
      return new Response("text is required", { status: 400, headers: corsHeaders });
    }

    const systemPrompt = PROMPTS[action];
    if (!systemPrompt) {
      return new Response("invalid action", { status: 400, headers: corsHeaders });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    let openaiRes: Response;
    try {
      openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          max_tokens: 1024,
          temperature: 0.3,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: text.slice(0, 4000) },
          ],
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!openaiRes.ok) {
      return new Response(`OpenAI error: ${openaiRes.status}`, { status: 502, headers: corsHeaders });
    }

    const data = await openaiRes.json() as { choices: { message: { content: string } }[] };
    const result = data.choices?.[0]?.message?.content?.trim() ?? "";

    if (JSON_ACTIONS.has(action)) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(result);
      } catch {
        return new Response("Invalid JSON from AI", { status: 502, headers: corsHeaders });
      }
      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(result, {
      headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(msg, { status: 500, headers: corsHeaders });
  }
});
