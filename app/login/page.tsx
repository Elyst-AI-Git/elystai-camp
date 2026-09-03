'use client'

import {useEffect, useState, type FormEvent} from 'react'
import {createAnonClient} from '../../lib/supabase/browser'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [forgotBusy, setForgotBusy] = useState(false)
  const [recovery, setRecovery] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [recoveryBusy, setRecoveryBusy] = useState(false)

  useEffect(() => {
    const supabase = createAnonClient()
    if (!supabase) return
    const {data} = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setRecovery(true)
        setError('')
        setSent(false)
      }
    })
    return () => data.subscription.unsubscribe()
  }, [])

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

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (newPassword.length < 8 || newPassword !== confirmPassword) {
      setError(newPassword.length < 8 ? 'Use at least 8 characters.' : 'Passwords do not match.')
      return
    }
    const supabase = createAnonClient()
    if (!supabase) {
      setError('Password reset is not configured yet. Add the Supabase environment variables.')
      return
    }
    setRecoveryBusy(true)
    try {
      const {error: updateError} = await supabase.auth.updateUser({password: newPassword})
      if (updateError) {
        setError('Could not update your password. Try the reset link again.')
        return
      }
      await supabase.auth.signOut()
      setNewPassword('')
      setConfirmPassword('')
      setRecovery(false)
      setSent(true)
    } catch {
      setError('Could not update your password. Try the reset link again.')
    } finally {
      setRecoveryBusy(false)
    }
  }

  return <main className="login-page"><section className="login-visual" aria-label="Elyst AI map"><img src="/brand/elystai-map.png" alt="Elyst AI work map"/></section><section className="login-card"><div className="login-lockup"><div className="login-lockup-main"><img src="/icon.svg" alt="Camp"/><span>camp</span></div><div className="login-lockup-by"><span>by</span><img src="/brand/elyst-ai-wordmark.png" alt="Elyst AI"/></div></div><p className="eyebrow">Private workspace</p><h1>Make room for<br/><em>the work that moves.</em></h1>{recovery ? <><p className="login-intro">Choose a new password for your Camp account.</p><form noValidate onSubmit={(event) => void updatePassword(event)}><label>New password<input value={newPassword} onChange={(event) => {setNewPassword(event.target.value);setError('')}} type="password" autoComplete="new-password"/></label><label>Confirm password<input value={confirmPassword} onChange={(event) => {setConfirmPassword(event.target.value);setError('')}} type="password" autoComplete="new-password"/></label>{error&&<p className="login-error" role="alert">{error}</p>}<button className="button dark" type="submit" disabled={recoveryBusy}>{recoveryBusy?'Updating…':'Update password'}</button></form></> : <><p className="login-intro">Sign in to the shared daily loop for Nihal and Shirin.</p><form noValidate onSubmit={(event) => void submit(event)}><label>Email<input value={email} onChange={(event) => {setEmail(event.target.value);setError('');setSent(false)}} type="email" autoComplete="email"/></label><label>Password<input value={password} onChange={(event) => {setPassword(event.target.value);setError('');setSent(false)}} type="password" autoComplete="current-password"/></label>{error&&<p className="login-error" role="alert">{error}</p>}{sent&&<p className="login-sent" role="status">{sent && 'Password reset complete. Sign in with your new password.'}</p>}<button className="button dark" type="submit" disabled={busy}>{busy?'Signing in…':'Sign in'}</button></form><button className="forgot" type="button" onClick={() => void forgot()} disabled={forgotBusy}>{forgotBusy?'Sending…':'Forgot password?'}</button></>}</section></main>
}
