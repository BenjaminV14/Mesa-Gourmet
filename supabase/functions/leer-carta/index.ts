// Supabase Edge Function: lee una carta desde fotos o un PDF escaneado y devuelve sus platos con precio.
// Solo la usa el administrador desde el panel (Cartas → Importar). El resultado se revisa antes de guardarlo.
//
// Despliegue:   supabase functions deploy leer-carta   (o el flujo .github/workflows/funciones.yml)
// Secreto:      el mismo ANTHROPIC_API_KEY de verificar-foto
// Uso en el panel: supabase.functions.invoke('leer-carta', { body: { archivos: [{ tipo: 'image/jpeg', datos: '<base64>' }] } })
import Anthropic from "npm:@anthropic-ai/sdk@0.135.0";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TIPOS_IMAGEN = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
const MAX_ARCHIVOS = 8;
const MAX_BYTES_TOTAL = 20 * 1024 * 1024;

const RESULT_SCHEMA = {
  type: "object",
  properties: {
    platos: {
      type: "array",
      items: {
        type: "object",
        properties: {
          nombre: { type: "string" },
          categoria: { type: "string" },
          precio: { type: "integer" },
          descripcion: { type: "string" },
          bebida: { type: "boolean" },
        },
        required: ["nombre", "categoria", "precio", "descripcion", "bebida"],
        additionalProperties: false,
      },
    },
  },
  required: ["platos"],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `Eres el asistente de cartas de Mesa Gourmet, una guía gastronómica de Talca, Chile.
Recibes fotos o un PDF de la carta de un local y transcribes cada plato o bebida que tenga precio:
- "nombre": tal como aparece en la carta, con mayúscula inicial (no todo en mayúsculas).
- "categoria": la sección de la carta donde está (ej. "Entradas", "Fondos", "Bebidas", "Postres"). Si no hay secciones, "Otros".
- "precio": en pesos chilenos, solo el número entero (ej. "$9.500" → 9500). Si un plato tiene varios tamaños,
  crea una entrada por tamaño con el tamaño en el nombre (ej. "Pizza napolitana familiar").
- "descripcion": los ingredientes o el detalle que aparece bajo el nombre, breve; vacío si no hay.
- "bebida": true si es una bebida, trago, café, jugo, cerveza o vino.
No inventes platos ni precios: omite lo que no se lea con claridad. No repitas el mismo plato con el mismo nombre.`;

const anthropic = new Anthropic(); // lee ANTHROPIC_API_KEY del entorno
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

type Archivo = { tipo: string; datos: string };
type Plato = { nombre: string; categoria: string; precio: number; descripcion: string; bebida: boolean };

async function leer(archivos: Archivo[]): Promise<Plato[]> {
  const contenido: Anthropic.Beta.BetaContentBlockParam[] = archivos.map((a) =>
    a.tipo === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: a.datos } }
      : { type: "image", source: { type: "base64", media_type: a.tipo as (typeof TIPOS_IMAGEN)[number], data: a.datos } }
  );
  contenido.push({ type: "text", text: "Transcribe los platos y precios de esta carta." });
  const response = await anthropic.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    // Si los filtros de seguridad del modelo rechazan la solicitud, se reintenta en otro modelo
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: {
      effort: "low", // transcripción
      format: { type: "json_schema", schema: RESULT_SCHEMA },
    },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: contenido }],
  });
  if (response.stop_reason === "refusal") throw new Error("La IA no pudo leer esta carta.");
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("Respuesta vacía de la IA.");
  const { platos } = JSON.parse(text.text) as { platos: Plato[] };
  return platos.filter((p) => p.nombre?.trim() && Number.isFinite(p.precio) && p.precio > 0);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  // Solo el administrador puede leer cartas
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Inicia sesión para continuar" }, 401);
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user) return json({ error: "Sesión no válida" }, 401);
  const { data: perfil } = await admin.from("perfiles").select("rol").eq("id", auth.user.id).maybeSingle();
  if (perfil?.rol !== "admin") return json({ error: "Solo el administrador puede leer cartas" }, 403);

  let archivos: Archivo[];
  try {
    ({ archivos } = await req.json());
    if (!Array.isArray(archivos) || !archivos.length || archivos.length > MAX_ARCHIVOS) throw new Error();
    const validos = archivos.every((a) =>
      typeof a?.datos === "string" && (a.tipo === "application/pdf" || (TIPOS_IMAGEN as readonly string[]).includes(a.tipo))
    );
    const bytes = archivos.reduce((s, a) => s + a.datos.length * 0.75, 0);
    if (!validos || bytes > MAX_BYTES_TOTAL) throw new Error();
  } catch {
    return json({ error: `El cuerpo debe ser JSON { archivos: [{ tipo, datos }] } con hasta ${MAX_ARCHIVOS} fotos o PDF (20 MB en total)` }, 400);
  }

  try {
    return json({ platos: await leer(archivos) });
  } catch (err) {
    if (err instanceof Anthropic.APIError) console.error(`Error de la API de Anthropic ${err.status}:`, err.message);
    else console.error("Error leyendo la carta:", err);
    return json({ error: "No se pudo leer la carta. Intenta con una foto más nítida." }, 502);
  }
});
