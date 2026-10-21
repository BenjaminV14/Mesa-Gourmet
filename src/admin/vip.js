// Clientes que este mes ya llegaron a 5 visitas o más en un mismo local.
// Recibirán el título VIP al cerrar el mes (el último día a las 23:59) y lo tendrán todo el mes siguiente.
// El panel los avisa en "Resumen" y con un número en "Top y clientes".
import { db } from '../data/store.js';
import { topClientes } from '../data/metrics.js';

export function nuevosVip(date = new Date()) {
    return db.locales.flatMap(local => topClientes(local.id, date)
        .filter(c => c.esClienteDelMes)
        .map(c => ({ ...c, local })));
}
