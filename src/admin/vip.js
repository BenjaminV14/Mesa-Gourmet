// Clientes que este mes ya llegaron a 5 visitas o más en un mismo local (clientes VIP).
// El panel los avisa en "Resumen" y con un número en "Top y clientes".
import { db } from '../data/store.js';
import { topClientes } from '../data/metrics.js';

export function nuevosVip(date = new Date()) {
    return db.locales.flatMap(local => topClientes(local.id, date)
        .filter(c => c.esClienteDelMes)
        .map(c => ({ ...c, local })));
}
