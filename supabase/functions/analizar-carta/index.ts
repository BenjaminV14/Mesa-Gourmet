// Supabase Edge Function: lee los platos de una carta y sugiere con IA (Claude) cuáles son
// vegetarianos, veganos, sin gluten y sin lactosa. Solo la usa el administrador desde el panel (Cartas);
// las sugerencias se revisan antes de guardarlas, porque la carta no siempre dice todos los ingredientes.
//
// Despliegue:   supabase functions deploy analizar-carta
// Secreto:      el mismo ANTHROPIC_API_KEY de verificar-foto
// Uso en el panel: supabase.functions.invoke('analizar-carta', { body: { platos: [{ nombre, categoria, descripcion }] } })
import Anthropic from "npm:@anthropic-ai/sdk@0.135.0";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DIETAS = ["vegetariano", "vegano", "sinGluten", "sinLactosa"] as const;

const RESULT_SCHEMA = {
  type: "object",
  properties: {
    platos: {
      type: "array",
      items: {
        type: "object",
        properties: {
          indice: { type: "integer" },
          dietas: { type: "array", items: { type: "string", enum: [...DIETAS] } },
          dudoso: { type: "boolean" },
          nota: { type: "string" },
        },
        required: ["indice", "dietas", "dudoso", "nota"],
        additionalProperties: false,
      },
    },
  },
  required: ["platos"],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `Eres el asistente de cartas de Mesa Gourmet, una guía gastronómica de Talca, Chile.
Recibes los platos de la carta de un local (nombre, categoría y a veces una descripción) y decides para cada uno
qué opciones alimentarias cumple según su receta habitual en Chile:
- "vegetariano": sin carne, ave, pescado ni mariscos.
- "vegano": vegetariano y además sin lácteos, huevo ni miel.
- "sinGluten": sin trigo, cebada ni centeno (pan, masa, pasta, apanado, cerveza común, salsa de soya común). Sé conservador: márcalo solo si el plato normalmente no lleva gluten.
- "sinLactosa": sin leche, queso, crema, mantequilla, manjar ni yogur.
Marca "dudoso" cuando la receta varía mucho entre locales o el nombre no basta (ej. "Ensalada de la casa", "Sándwich especial").
"nota" va en español, muy breve (ej. "Lleva queso", "La masa lleva trigo"). Ejemplos chilenos:
"Completo italiano" lleva pan y mayonesa (con huevo): no es vegetariano si la vienesa es de carne.
"Empanada de pino" lleva carne y masa de trigo. "Pisco sour" suele llevar clara de huevo: vegetariano, no vegano, sin gluten.`;

const anthropic = new Anthropic(); // lee ANTHROPIC_API_KEY del entorno
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

type Plato = { nombre: string; categoria?: string; descripcion?: string };
type Resultado = { indice: number; dietas: string[]; dudoso: boolean; nota: string };

async function analizar(platos: Plato[]): Promise<Resultado[]> {
  const lista = platos
    .map((p, i) => `${i}. ${p.nombre.slice(0, 120)}${p.categoria ? ` [${p.categoria.slice(0, 40)}]` : ""}${p.descripcion ? ` — ${p.descripcion.slice(0, 200)}` : ""}`)
    .join("\n");
  const response = await anthropic.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 8000,
    // Si los filtros de seguridad del modelo rechazan la solicitud, se reintenta en otro modelo
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: {
      effort: "low", // clasificación sencilla
      format: { type: "json_schema", schema: RESULT_SCHEMA },
    },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: `Platos de la carta (índice. nombre [categoría] — descripción):\n${lista}` }],
  });
  if (response.stop_reason === "refusal") throw new Error("La IA no pudo analizar esta carta.");
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("Respuesta vacía de la IA.");
  const { platos: resultado } = JSON.parse(text.text) as { platos: Resultado[] };
  return resultado
    .filter((r) => r.indice >= 0 && r.indice < platos.length)
    .map((r) => ({ ...r, dietas: r.dietas.filter((d) => (DIETAS as readonly string[]).includes(d)) }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  // Solo el administrador puede analizar cartas
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Inicia sesión para continuar" }, 401);
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user) return json({ error: "Sesión no válida" }, 401);
  const { data: perfil } = await admin.from("perfiles").select("rol").eq("id", auth.user.id).maybeSingle();
  if (perfil?.rol !== "admin") return json({ error: "Solo el administrador puede analizar cartas" }, 403);

  let platos: Plato[];
  try {
    ({ platos } = await req.json());
    if (!Array.isArray(platos) || !platos.length || platos.length > 300) throw new Error();
    platos = platos.filter((p) => typeof p?.nombre === "string" && p.nombre.trim());
  } catch {
    return json({ error: "El cuerpo debe ser JSON { platos: [{ nombre, categoria, descripcion }] } (máximo 300)" }, 400);
  }

  try {
    // De a 60 platos por consulta para respuestas rápidas
    const resultados: Resultado[] = [];
    for (let i = 0; i < platos.length; i += 60) {
      const parte = await analizar(platos.slice(i, i + 60));
      resultados.push(...parte.map((r) => ({ ...r, indice: r.indice + i })));
    }
    return json({ platos: resultados });
  } catch (err) {
    if (err instanceof Anthropic.APIError) console.error(`Error de la API de Anthropic ${err.status}:`, err.message);
    else console.error("Error analizando la carta:", err);
    return json({ error: "No se pudo analizar la carta. Intenta de nuevo." }, 502);
  }
});
