'use client'

import {useState, type FormEvent} from 'react'
import {createAnonClient} from '../../lib/supabase/browser'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [forgotBusy, setForgotBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSent(false)
    if (!email.trim() || !password) {
      setPassword('')
      setError('Enter your email and password.')
      return
    }
    setBusy(true)
    const supabase = createAnonClient()
    if (!supabase) {
      setPassword('')
      setError('Sign-in is not configured yet. Add the Supabase environment variables.')
      setBusy(false)
      return
    }
    try {
      const {error: signInError} = await supabase.auth.signInWithPassword({email: email.trim(), password})
      if (signInError) {
        setPassword('')
        setError('Incorrect email or password')
        return
      }
      const nextParam = new URLSearchParams(window.location.search).get('next')
      const next = nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/'
      window.location.assign(next)
    } catch {
      setPassword('')
      setError('Incorrect email or password')
    } finally {
      setBusy(false)
    }
  }

  async function forgot() {
    setError('')
    setSent(false)
    if (!email.trim()) {
      setError('Enter your email first.')
      return
    }
    const supabase = createAnonClient()
    if (!supabase) {
      setError('Password reset is not configured yet. Add the Supabase environment variables.')
      return
    }
    setForgotBusy(true)
    try {
      const {error: resetError} = await supabase.auth.resetPasswordForEmail(email.trim(), {redirectTo: `${window.location.origin}/login`})
      if (resetError) {
        setError('Could not send the reset email. Try again.')
        return
      }
      setSent(true)
    } catch {
      setError('Could not send the reset email. Try again.')
    } finally {
      setForgotBusy(false)
    }
  }

  return <main className="login-page"><section className="login-visual" aria-label="Elyst AI map"><img src="/brand/elystai-map.png" alt="Elyst AI work map"/></section><section className="login-card"><div className="login-lockup"><div className="login-lockup-main"><img src="/icon.svg" alt="Camp"/><span>camp</span></div><div className="login-lockup-by"><span>by</span><img src="/brand/elyst-ai-wordmark.png" alt="Elyst AI"/></div></div><p className="eyebrow">Private workspace</p><h1>Make room for<br/><em>the work that moves.</em></h1><p className="login-intro">Sign in to the shared daily loop for Nihal and Shirin.</p><form noValidate onSubmit={(event) => void submit(event)}><label>Email<input value={email} onChange={(event) => {setEmail(event.target.value);setError('');setSent(false)}} type="email" autoComplete="email"/></label><label>Password<input value={password} onChange={(event) => {setPassword(event.target.value);setError('');setSent(false)}} type="password" autoComplete="current-password"/></label>{error&&<p className="login-error" role="alert">{error}</p>}{sent&&<p className="login-sent" role="status">Reset email sent.</p>}<button className="button dark" type="submit" disabled={busy}>{busy?'Signing in…':'Sign in'}</button></form><button className="forgot" type="button" onClick={() => void forgot()} disabled={forgotBusy}>{forgotBusy?'Sending…':'Forgot password?'}</button></section></main>
}
