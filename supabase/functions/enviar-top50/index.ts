// Supabase Edge Function: envía a cada local, por correo, su Top 50 de clientes del mes que terminó.
//
// - Solo aparecen con nombre, apellido y @usuario quienes aceptaron compartir esos datos con los locales
//   (perfiles.comparte_con_locales). Al resto se les cuenta, sin datos personales.
// - Solo se envía a los locales que pidieron la lista (contactos_locales.recibe_top50).
// - Los números del mes (visitas a la ficha, contactos, clientes nuevos...) van solo a los locales
//   con patrocinio pagado que cubra ese mes: son parte del plan de patrocinio.
// - Solo se envían meses ya terminados, y nunca dos veces al mismo local (queda en envios_top50).
//   Por eso cualquiera puede llamarla sin causar daño: la programación (pg_cron, día 1 a las 10:00)
//   la llama sin clave. Un administrador puede, desde el panel, reenviar un mes o un local.
// - La lista con datos personales (top50_mes) se borra sola al cerrar el mes siguiente (ver actualizacion-3.sql).
//
// Despliegue:  supabase functions deploy enviar-top50 --no-verify-jwt
// Secretos:    RESEND_API_KEY   clave de resend.com (API Keys)
//              REMITENTE        "Mesa Gourmet <top50@tu-dominio.cl>" (dominio verificado en Resend)
//              CORREO_ADMIN     tu correo: recibe una copia de cada envío y, en modo prueba, todos los correos
// Modo prueba: mientras no exista REMITENTE (o no tengas dominio verificado), los correos se envían SOLO
//              a CORREO_ADMIN desde onboarding@resend.dev, que es lo único que Resend permite sin dominio.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los entrega Supabase automáticamente a las funciones
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

type Persona = { puesto: number; resenas: number; comparte: boolean; nombre: string | null; apellido: string | null; username: string | null };
type Stats = { resenas: number; clientes_unicos: number; clientes_recurrentes: number; clientes_nuevos: number; nota_promedio: number | null; vistas: number; contactos: number } | null;

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const nombreMes = (mes: string) => { const [y, m] = mes.split("-").map(Number); return `${MESES[m - 1]} ${y}`; };

/** Primer día del mes actual en Chile, como "AAAA-MM-01" */
function mesActualChile(): string {
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  const y = partes.find(p => p.type === "year")!.value, m = partes.find(p => p.type === "month")!.value;
  return `${y}-${m}-01`;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}

/** Último día del mes "AAAA-MM-01" */
function finDeMes(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

/** ¿La llamada viene de un administrador conectado en el panel? */
async function esAdmin(req: Request): Promise<boolean> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const { data } = await supabase.auth.getUser(token);
  if (!data.user) return false;
  const { data: p } = await supabase.from("perfiles").select("rol").eq("id", data.user.id).single();
  return p?.rol === "admin";
}

function correoHtml(local: { nombre: string; beneficio_top50: string | null }, contacto: string | null, mes: string, personas: Persona[], stats: Stats) {
  const conNombre = personas.filter(p => p.comparte);
  const anonimos = personas.length - conNombre.length;
  const filas = conNombre.map(p => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;font-weight:700">${p.puesto}</td>
        <td style="padding:8px;border-bottom:1px solid #eee">${esc([p.nombre, p.apellido].filter(Boolean).join(" "))}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;color:#7a1f2b">@${esc(p.username)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${p.resenas}</td>
      </tr>`).join("");
  const dato = (titulo: string, valor: unknown) => `<td style="padding:10px;text-align:center"><div style="font-size:22px;font-weight:700;color:#7a1f2b">${esc(valor)}</div><div style="font-size:12px;color:#666">${titulo}</div></td>`;
  return `<!doctype html><html><body style="margin:0;background:#f6f1ea;font-family:Arial,Helvetica,sans-serif;color:#222">
  <div style="max-width:640px;margin:0 auto;padding:24px">
    <div style="background:#7a1f2b;color:#fff;border-radius:14px 14px 0 0;padding:20px 24px">
      <div style="font-size:13px;opacity:.85">Mesa Gourmet · Talca</div>
      <div style="font-size:22px;font-weight:700;margin-top:4px">Tus mejores clientes de ${esc(nombreMes(mes))}</div>
    </div>
    <div style="background:#fff;border-radius:0 0 14px 14px;padding:24px">
      <p>Hola${contacto ? ` ${esc(contacto)}` : ""},</p>
      <p>Estas son las personas que más visitaron <b>${esc(local.nombre)}</b> en ${esc(nombreMes(mes))} según Mesa Gourmet
      (5 reseñas o más en el mes, cada una de un día distinto).</p>
      ${stats ? `<table style="width:100%;border-collapse:collapse;background:#faf6f0;border-radius:10px;margin:16px 0"><tr>
        ${dato("reseñas", stats.resenas)}${dato("clientes distintos", stats.clientes_unicos)}${dato("volvieron 2+ veces", stats.clientes_recurrentes)}${dato("clientes nuevos", stats.clientes_nuevos)}
      </tr><tr>
        ${dato("nota promedio", stats.nota_promedio ?? "—")}${dato("visitas a tu ficha", stats.vistas)}${dato("contactos (WhatsApp, llamadas, cómo llegar)", stats.contactos)}${dato("en tu Top 50", personas.length)}
      </tr></table>` : ""}
      ${conNombre.length ? `
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:8px">
        <tr style="background:#f6f1ea"><th style="padding:8px">#</th><th style="padding:8px;text-align:left">Nombre</th><th style="padding:8px;text-align:left">Usuario en la app</th><th style="padding:8px">Reseñas</th></tr>
        ${filas}
      </table>` : `<p><i>Ninguno de tus clientes del Top 50 aceptó compartir su nombre este mes.</i></p>`}
      ${anonimos ? `<p style="color:#555">Además, <b>${anonimos}</b> cliente(s) de tu Top 50 prefirieron no compartir sus datos. Igual pueden identificarse en tu local mostrando su insignia en la app.</p>` : ""}
      ${local.beneficio_top50 ? `<div style="background:#fff7e0;border:1px solid #f0d27a;border-radius:10px;padding:12px 14px;margin:16px 0">
        <b>🎁 Beneficio que ofreces a tu Top 50:</b> ${esc(local.beneficio_top50)}<br>
        <span style="font-size:13px;color:#555">Tus clientes lo ven en su perfil de la app y lo muestran en caja junto con su @usuario. Revisa que el @ esté en esta lista.</span>
      </div>` : ""}
      <div style="font-size:12px;color:#666;border-top:1px solid #eee;margin-top:20px;padding-top:12px;line-height:1.5">
        <b>Uso de estos datos:</b> estas personas aceptaron que Mesa Gourmet comparta su nombre y @usuario contigo
        <b>solo para que puedas reconocerlas y ofrecerles un beneficio</b>. No los uses para otros fines, no los compartas con terceros
        y elimina esta lista cuando ya no la necesites (a más tardar al recibir la del próximo mes), según la Ley 21.719 de protección de datos personales.
        Si alguien te pide no aparecer, avísanos a este mismo correo.
      </div>
    </div>
  </div></body></html>`;
}

async function enviarCorreo(para: string[], asunto: string, html: string, responderA: string | null) {
  const clave = Deno.env.get("RESEND_API_KEY");
  if (!clave) throw new Error("Falta el secreto RESEND_API_KEY");
  const remitente = Deno.env.get("REMITENTE") || "Mesa Gourmet <onboarding@resend.dev>";
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${clave}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: remitente, to: para, subject: asunto, html, ...(responderA ? { reply_to: responderA } : {}) }),
  });
  if (!r.ok) throw new Error(`Resend respondió ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Usa POST" }, 405);

  const body = await req.json().catch(() => ({}));
  const admin = await esAdmin(req);
  // Solo un administrador puede elegir el mes, un local, o forzar un reenvío
  const mesPedido: string | null = admin && /^\d{4}-\d{2}-01$/.test(body.mes || "") ? body.mes : null;
  const localPedido: number | null = admin && Number.isInteger(body.local_id) ? body.local_id : null;
  const reenviar = admin && body.reenviar === true;

  const correoAdmin = Deno.env.get("CORREO_ADMIN") || null;
  const modoPrueba = !Deno.env.get("REMITENTE");
  if (modoPrueba && !correoAdmin) return json({ error: "Modo prueba: falta el secreto CORREO_ADMIN (sin dominio verificado, Resend solo envía a tu propio correo)." }, 500);

  // Meses ya terminados que tienen lista
  const actual = mesActualChile();
  let consulta = supabase.from("top50_para_locales").select("mes, local_id, puesto, resenas, comparte, nombre, apellido, username").lt("mes", actual).order("puesto");
  if (mesPedido) consulta = consulta.eq("mes", mesPedido);
  if (localPedido) consulta = consulta.eq("local_id", localPedido);
  const { data: filas, error } = await consulta;
  if (error) return json({ error: error.message }, 500);

  const grupos = new Map<string, Persona[]>();
  for (const f of filas || []) {
    const k = `${f.mes}|${f.local_id}`;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k)!.push(f);
  }
  if (!grupos.size) return json({ enviados: 0, mensaje: "No hay listas pendientes." });

  const localIds = [...new Set([...grupos.keys()].map(k => Number(k.split("|")[1])))];
  const [{ data: locales }, { data: contactos }, { data: envios }, { data: stats }, { data: patrocinios }] = await Promise.all([
    supabase.from("locales").select("id, nombre, activo, beneficio_top50").in("id", localIds),
    supabase.from("contactos_locales").select("local_id, email, contacto, recibe_top50").in("local_id", localIds),
    supabase.from("envios_top50").select("mes, local_id, estado").in("local_id", localIds),
    supabase.from("estadisticas_mes").select("*").in("local_id", localIds),
    supabase.from("patrocinios").select("local_id, desde, hasta, pagado").eq("pagado", true).in("local_id", localIds),
  ]);
  // Patrocinio pagado que se cruza con el mes
  const patrocinado = (localId: number, mes: string) =>
    (patrocinios || []).some(p => p.local_id === localId && p.desde <= finDeMes(mes) && p.hasta >= mes);

  const resultado: { local: string; mes: string; estado: string; detalle?: string }[] = [];
  for (const [k, personas] of grupos) {
    const [mes, idTxt] = k.split("|");
    const localId = Number(idTxt);
    const local = locales?.find(l => l.id === localId);
    const contacto = contactos?.find(c => c.local_id === localId);
    const nombre = local?.nombre || `Local ${localId}`;
    if (!local || local.activo === false) { resultado.push({ local: nombre, mes, estado: "omitido", detalle: "local inactivo" }); continue; }
    if (!contacto?.email || !contacto.recibe_top50) { resultado.push({ local: nombre, mes, estado: "omitido", detalle: "sin correo registrado o no quiere recibir la lista" }); continue; }
    const previo = envios?.find(e => e.mes === mes && e.local_id === localId);
    // En modo prueba se puede volver a probar; un envío real no se repite (salvo reenvío del administrador)
    if (previo?.estado === "enviado" && !reenviar) { resultado.push({ local: nombre, mes, estado: "ya enviado" }); continue; }

    const st = patrocinado(localId, mes) ? (stats || []).find(s => s.mes === mes && s.local_id === localId) || null : null;
    const asunto = `Tus mejores clientes de ${nombreMes(mes)} · Mesa Gourmet`;
    const html = correoHtml(local, contacto.contacto, mes, personas, st);
    try {
      if (modoPrueba) {
        await enviarCorreo([correoAdmin!], `[PRUEBA para ${contacto.email}] ${asunto}`, html, null);
      } else {
        await enviarCorreo([contacto.email], asunto, html, correoAdmin);
        if (correoAdmin) await enviarCorreo([correoAdmin], `[Copia] ${nombre} · ${asunto}`, html, null).catch(() => {});
      }
      const estado = modoPrueba ? "prueba" : "enviado";
      await supabase.from("envios_top50").upsert({ mes, local_id: localId, email: contacto.email, personas: personas.length, estado, detalle: null, enviado_at: new Date().toISOString() });
      resultado.push({ local: nombre, mes, estado });
    } catch (e) {
      const detalle = String((e as Error).message || e).slice(0, 300);
      await supabase.from("envios_top50").upsert({ mes, local_id: localId, email: contacto.email, personas: personas.length, estado: "error", detalle, enviado_at: new Date().toISOString() });
      resultado.push({ local: nombre, mes, estado: "error", detalle });
    }
    // Resend permite 2 correos por segundo en el plan gratis
    await new Promise(r => setTimeout(r, 1100));
  }
  return json({ modoPrueba, enviados: resultado.filter(r => r.estado === "enviado" || r.estado === "prueba").length, resultado });
});
