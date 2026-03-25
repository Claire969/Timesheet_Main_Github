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

const JSON_ACTIONS = new Set(["polish_incident_fr", "polish_incident_en"]);

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
    const { text, action } = await req.json() as { text: string; action: string };

    if (!text?.trim()) {
      return new Response("text is required", { status: 400, headers: corsHeaders });
    }

    const systemPrompt = PROMPTS[action];
    if (!systemPrompt) {
      return new Response("invalid action", { status: 400, headers: corsHeaders });
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      return new Response("OpenAI not configured", { status: 500, headers: corsHeaders });
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
