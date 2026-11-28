/**
 * GET /api/drive?id=<Drive file id>: a shared Google Drive file, read for
 * Strata's reading view and embed.
 *
 * Drive lets other sites read a file only through its API, with an API key.
 * The key lives here on the server, in the GOOGLE_DRIVE_API_KEY environment
 * variable, and never reaches the browser. This is not a general relay: it
 * reads one Drive file by id, only one shared with "Anyone with the link"
 * (an API key can't open anything else), and passes it on only if it is a
 * JSON object of reasonable size. docs/decisions.md, "Google Drive Links
 * Through a Drive-Only Proxy".
 *
 * Vercel runs any file in /api as a function; this one uses the Web-standard
 * Request and Response, so it needs no Vercel package.
 */

/** Largest file passed on. The biggest real analyses are well under 1 MB. */
const MAX_BYTES = 5 * 1024 * 1024

/** Drive file ids are letters, digits, '-' and '_'. */
const DRIVE_ID = /^[A-Za-z0-9_-]{10,200}$/

function answer(status: number, body: unknown, cache = 'no-store'): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cache },
  })
}

const fail = (status: number, error: string) => answer(status, { error })

export async function GET(request: Request): Promise<Response> {
  const key = process.env.GOOGLE_DRIVE_API_KEY
  if (!key) return fail(503, 'Strata isn’t set up to read Google Drive here.')

  const id = new URL(request.url).searchParams.get('id') ?? ''
  if (!DRIVE_ID.test(id)) return fail(400, 'This doesn’t look like a Google Drive file link.')

  const driveUrl = `https://www.googleapis.com/drive/v3/files/${id}?alt=media&key=${encodeURIComponent(key)}`
  let res: Response
  try {
    res = await fetch(driveUrl, { redirect: 'follow' })
  } catch {
    return fail(502, 'Google Drive didn’t answer. Try again in a moment.')
  }
  if (res.status === 403 || res.status === 404) {
    return fail(404, 'Google Drive wouldn’t give out the file. Check it’s shared with “Anyone with the link”.')
  }
  if (res.status === 429) return fail(503, 'Google Drive is busy. Try again in a minute.')
  if (!res.ok) return fail(502, `Google Drive answered ${res.status}.`)

  const length = Number(res.headers.get('content-length') ?? 0)
  if (length > MAX_BYTES) return fail(413, 'The file is too large to be a Strata analysis.')
  const text = await res.text()
  if (text.length > MAX_BYTES) return fail(413, 'The file is too large to be a Strata analysis.')

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return fail(415, 'That Drive file isn’t a Strata analysis.')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return fail(415, 'That Drive file isn’t a Strata analysis.')
  }

  // Vercel's edge cache keeps a file a minute, so a link opened by a class at
  // once costs Drive one read, and an edit shows up soon after.
  return new Response(text, {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=300',
    },
  })
}
