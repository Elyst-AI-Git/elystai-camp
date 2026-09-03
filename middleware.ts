import {createServerClient} from '@supabase/ssr'
import {NextResponse, type NextRequest} from 'next/server'

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key || request.nextUrl.pathname === '/login') return NextResponse.next()

  try {
    let response = NextResponse.next({request})
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => {
          cookies.forEach(({name, value}) => request.cookies.set(name, value))
          response = NextResponse.next({request})
          cookies.forEach(({name, value, options}) => response.cookies.set(name, value, options))
        },
      },
    })
    const {data, error} = await supabase.auth.getUser()
    // A missing/invalid session is an authentication failure and should go to
    // the login screen. Other errors (for example a temporary Supabase outage)
    // are allowed through so middleware never takes the whole app down.
    const authStatus = typeof (error as {status?: unknown} | null)?.status === 'number'
      ? (error as {status: number}).status
      : undefined
    if (error && (authStatus === undefined || authStatus < 400 || authStatus >= 500)) return response
    if (error || !data.user) {
      const login = new URL('/login', request.url)
      login.searchParams.set('next', request.nextUrl.pathname)
      return NextResponse.redirect(login)
    }
    return response
  } catch {
    // A missing or unavailable Supabase service must not take down the app.
    return NextResponse.next()
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|brand/|avatars/|icon\\.svg).*)'],
}
