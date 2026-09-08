// Retired: never import the legacy shared-access gateway here.
export default async function handler() { return Response.json({ error: { code: 'AI_ENDPOINT_RETIRED', message: 'Abre Sifran desde su versión conectada.' } }, { status: 410, headers: { 'Cache-Control': 'no-store' } }); }
