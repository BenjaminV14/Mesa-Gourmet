// Supabase Edge Function: revisa con IA (Claude) si cada foto de una reseña muestra el plato indicado.
// Las fotos aprobadas quedan visibles; las dudosas pasan a Moderación; si alguna claramente no es
// comida (o es inapropiada), la reseña completa queda en revisión.
//
// Flujo seguro: la app guarda la reseña, sube las fotos a Storage (una fila por foto en resena_fotos,
// siempre sin verificar) y luego llama a esta función con el id. La función (no la app) descarga cada
// foto, la verifica y marca el resultado. Las fotos sin verificar no las ve nadie más que su dueño.
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

type Foto = { id: string; plato: string; path: string };

// Descarga una foto desde Storage y se la muestra a Claude junto con el nombre del plato
async function verificarFoto(foto: Foto): Promise<Verdict> {
  const { data: file, error } = await admin.storage.from("fotos-resenas").download(foto.path);
  if (error || !file) return { estado: "revision", motivo: "No encontramos la foto; la verá un moderador." };
  const mediaType = (["image/jpeg", "image/png", "image/webp"].includes(file.type) ? file.type : "image/jpeg") as ImageMediaType;
  const data = toBase64(new Uint8Array(await file.arrayBuffer()));
  return askClaude(data, mediaType, foto.plato.replace(/\s*\(x\d+\)$/, ""));
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

  // 2. La reseña debe ser del usuario (o quien llama debe ser admin)
  const { data: resena } = await admin
    .from("resenas")
    .select("id, usuario_id, estado")
    .eq("id", resenaId)
    .maybeSingle();
  if (!resena) return json({ error: "Reseña no encontrada" }, 404);
  if (resena.usuario_id !== auth.user.id) {
    const { data: perfil } = await admin.from("perfiles").select("rol").eq("id", auth.user.id).maybeSingle();
    if (perfil?.rol !== "admin") return json({ error: "Reseña no encontrada" }, 404);
  }

  // 3. Fotos de la reseña que aún no están verificadas
  const { data: fotos } = await admin
    .from("resena_fotos")
    .select("id, plato, path")
    .eq("resena_id", resena.id)
    .eq("verificada", false);
  if (!fotos?.length) return json({ error: "La reseña no tiene fotos esperando verificación" }, 409);

  // 4. Verificar cada foto con IA (de a 4 a la vez) y aplicar el resultado
  const revisar = async (foto: Foto) => {
    const verdict = await verificarFoto(foto);
    if (verdict.estado === "aprobada") {
      await admin.from("resena_fotos").update({ verificada: true }).eq("id", foto.id);
    } else {
      // Dudosa o rechazada: un moderador la revisa en el panel
      await admin.from("moderacion").insert({ resena_id: resena.id, foto_id: foto.id, motivo: verdict.motivo });
    }
    return { foto_id: foto.id, plato: foto.plato, ...verdict };
  };
  const pendientes = fotos as Foto[];
  const resultados: Awaited<ReturnType<typeof revisar>>[] = [];
  for (let i = 0; i < pendientes.length; i += 4) {
    resultados.push(...await Promise.all(pendientes.slice(i, i + 4).map(revisar)));
  }

  // 5. Si alguna foto claramente no corresponde, la reseña queda oculta hasta que un moderador decida
  const enRevision = resultados.some((r) => r.estado === "rechazada");
  if (enRevision) {
    await admin.from("resenas").update({ estado: "pendiente" }).eq("id", resena.id).eq("estado", "publicada");
  }

  return json({ estado: enRevision ? "pendiente" : resena.estado, fotos: resultados });
});
