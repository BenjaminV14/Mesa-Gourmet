// Supabase Edge Function: revisa con IA (Claude) si la foto de una reseña muestra el plato elegido,
// y según el resultado publica la reseña o la deja para revisión manual.
//
// Flujo seguro: la app guarda la reseña como "pendiente" con su foto en Storage y luego llama a esta
// función con el id. La función (no la app) descarga la foto, la verifica y cambia el estado.
// Así nadie puede saltarse el filtro desde la app.
//
// Despliegue:   supabase functions deploy verificar-foto
// Secreto:      supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// Uso en la app: supabase.functions.invoke('verificar-foto', { body: { resena_id } })
import Anthropic from "npm:@anthropic-ai/sdk@0.135.0";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RESULT_SCHEMA = {
  type: "object",
  properties: {
    estado: { type: "string", enum: ["aprobada", "rechazada", "revision"] },
    motivo: { type: "string" },
  },
  required: ["estado", "motivo"],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `Eres el moderador de fotos de Mesa Gourmet, una guía gastronómica de Talca, Chile.
Los usuarios suben una foto junto con el nombre del plato o producto que consumieron en un local.
Decide si la foto corresponde a ese plato o producto:
- "aprobada": la foto muestra comida o bebida compatible con el nombre (no tiene que ser idéntica a una foto de catálogo; una presentación casera o parcial está bien).
- "rechazada": la foto claramente no es ese plato ni comida relacionada (por ejemplo una mascota, un meme, una captura de pantalla, una persona sin comida, otro tipo de plato muy distinto).
- "revision": no se puede saber con seguridad (foto muy oscura, borrosa, muy lejana, o el nombre del plato es ambiguo).
El "motivo" va en español, en una frase corta y amable que se le puede mostrar al usuario.`;

type Verdict = { estado: "aprobada" | "rechazada" | "revision"; motivo: string };
type ImageMediaType = "image/jpeg" | "image/png" | "image/webp";

const FALLBACK: Verdict = { estado: "revision", motivo: "No pudimos revisar la foto automáticamente; la verá un moderador." };

const anthropic = new Anthropic(); // lee ANTHROPIC_API_KEY del entorno
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los entrega Supabase automáticamente a las funciones
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

async function askClaude(data: string, mediaType: ImageMediaType, dish: string): Promise<Verdict> {
  try {
    const response = await anthropic.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 1024,
      // Si los filtros de seguridad del modelo rechazan la solicitud, se reintenta en otro modelo
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: {
        effort: "low", // tarea simple de clasificación
        format: { type: "json_schema", schema: RESULT_SCHEMA },
      },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data } },
            { type: "text", text: `Plato o producto declarado: "${dish.slice(0, 120)}"` },
          ],
        },
      ],
    });
    if (response.stop_reason === "refusal") return FALLBACK;
    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") return FALLBACK;
    const result = JSON.parse(text.text) as Verdict;
    return ["aprobada", "rechazada", "revision"].includes(result.estado) ? result : FALLBACK;
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      console.error(`Error de la API de Anthropic ${err.status}:`, err.message);
    } else {
      console.error("Error verificando la foto:", err);
    }
    return FALLBACK;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  // 1. ¿Quién llama? (token de la sesión del usuario)
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Inicia sesión para continuar" }, 401);
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user) return json({ error: "Sesión no válida" }, 401);

  let resenaId: string;
  try {
    ({ resena_id: resenaId } = await req.json());
  } catch {
    return json({ error: "El cuerpo debe ser JSON { resena_id }" }, 400);
  }

  // 2. La reseña debe ser del usuario y estar pendiente con foto
  const { data: resena } = await admin
    .from("resenas")
    .select("id, usuario_id, productos, foto_path, estado")
    .eq("id", resenaId)
    .maybeSingle();
  if (!resena || resena.usuario_id !== auth.user.id) return json({ error: "Reseña no encontrada" }, 404);
  if (resena.estado !== "pendiente" || !resena.foto_path) return json({ error: "La reseña no está esperando verificación" }, 409);

  // 3. Descargar la foto desde Storage
  const { data: file, error: fileError } = await admin.storage.from("fotos-resenas").download(resena.foto_path);
  if (fileError || !file) return json({ error: "No se encontró la foto" }, 404);
  const mediaType = (["image/jpeg", "image/png", "image/webp"].includes(file.type) ? file.type : "image/jpeg") as ImageMediaType;
  const data = toBase64(new Uint8Array(await file.arrayBuffer()));

  // 4. Verificar con IA el primer plato declarado
  const dish = String(resena.productos[0] ?? "").replace(/\s*\(x\d+\)$/, "");
  const verdict = await askClaude(data, mediaType, dish);

  // 5. Aplicar el resultado
  if (verdict.estado === "aprobada") {
    await admin.from("resenas").update({ estado: "publicada", foto_verificada: true }).eq("id", resena.id);
  } else if (verdict.estado === "revision") {
    // Se publica, pero un moderador confirmará la foto
    await admin.from("resenas").update({ estado: "publicada" }).eq("id", resena.id);
    await admin.from("moderacion").insert({ resena_id: resena.id, motivo: verdict.motivo });
  } else {
    // Rechazada por la IA: queda oculta hasta que un moderador decida
    await admin.from("moderacion").insert({ resena_id: resena.id, motivo: verdict.motivo });
  }

  return json(verdict);
});
