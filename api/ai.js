// Retired: account-bound AI is served only by the Sites Worker.
export default function handler(req, res) { res.statusCode = 410; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify({ error: { code: 'AI_ENDPOINT_RETIRED', message: 'Abre Sifran desde su versión conectada.' } })); }
