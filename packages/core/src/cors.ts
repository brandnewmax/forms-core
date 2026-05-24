export function isOriginAllowed(origin: string, allowedCsv: string): boolean {
  const list = allowedCsv.split(',').map(s => s.trim()).filter(Boolean);
  if (list.includes('*')) return true;
  return list.includes(origin);
}

export function corsHeaders(
  origin: string | null,
  allowedCsv: string,
): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  if (origin && isOriginAllowed(origin, allowedCsv)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

export function handlePreflight(req: Request, allowedCsv: string): Response {
  const origin = req.headers.get('Origin');
  return new Response(null, {
    status: 204,
    headers: corsHeaders(origin, allowedCsv),
  });
}
