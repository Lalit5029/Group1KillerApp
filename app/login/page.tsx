'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [focused, setFocused] = useState('')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError('Invalid email or password.')
        setIsLoading(false)
        return
      }

      router.push('/students')
      router.refresh()
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
      setIsLoading(false)
    }
  }

  const inputStyle = (name: string): React.CSSProperties => ({
    width: '100%',
    padding: '13px 14px',
    border: `1.5px solid ${focused === name ? '#ff6600' : 'rgba(255,255,255,0.15)'}`,
    borderRadius: '10px',
    fontSize: '14px',
    color: '#fff',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
    background: 'rgba(255,255,255,0.07)',
  })

  return (
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: "'Segoe UI', sans-serif" }}>

      {/* Left Panel */}
      <div style={{
        flex: 1,
        background: 'linear-gradient(160deg, #ff6600 0%, #cc4400 60%, #0d1b3e 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '60px 48px', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: '-80px', left: '-80px', width: '300px', height: '300px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
        <div style={{ position: 'absolute', bottom: '-60px', right: '-60px', width: '250px', height: '250px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
        <div style={{ position: 'absolute', top: '40%', left: '60%', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />

        <div style={{ position: 'relative', textAlign: 'center', color: '#fff' }}>
          <div style={{
            width: '72px', height: '72px',
            background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)',
            border: '2px solid rgba(255,255,255,0.3)', borderRadius: '20px',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '28px', fontWeight: 900, fontFamily: 'Georgia, serif', marginBottom: '28px',
          }}>SU</div>

          <h1 style={{ margin: '0 0 12px', fontSize: '32px', fontWeight: 800, lineHeight: 1.2 }}>
            Syracuse<br />University
          </h1>
          <p style={{ margin: 0, fontSize: '15px', opacity: 0.75, maxWidth: '240px', lineHeight: 1.6 }}>
            Your gateway to academics, resources, and campus life.
          </p>

          <div style={{ marginTop: '48px', display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
            {['Access course materials & grades', 'Connect with faculty & staff', 'Manage your student portal'].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', opacity: 0.85 }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✓</div>
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div style={{
        width: '460px', background: '#0d1b3e',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '60px 48px',
      }}>
        <div style={{ width: '100%', maxWidth: '340px' }}>
          <Link href="/" style={{ color: '#ff6600', fontSize: '13px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '24px' }}>
            ← Back to Home
          </Link>

          <h2 style={{ margin: '0 0 6px', fontSize: '24px', fontWeight: 700, color: '#fff' }}>Welcome back</h2>
          <p style={{ margin: '0 0 32px', color: '#64748b', fontSize: '14px' }}>Sign in to your advisor account</p>

          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.12)', border: '1.5px solid rgba(239,68,68,0.25)',
              borderRadius: '10px', padding: '10px 14px', marginBottom: '16px',
              color: '#fca5a5', fontSize: '13px',
            }}>{error}</div>
          )}

          <form
            onSubmit={handleSubmit}
            method="post"
            action="#"
            noValidate
          >
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>Email</label>
            <input
              name="email"
              type="email"
              placeholder="netid@syr.edu"
              required
              autoComplete="email"
              style={{ ...inputStyle('email'), marginBottom: '16px' }}
              onFocus={() => setFocused('email')}
              onBlur={() => setFocused('')}
            />

            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>Password</label>
            <div style={{ position: 'relative', marginBottom: '8px' }}>
              <input
                name="password"
                type={showPass ? 'text' : 'password'}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                style={{ ...inputStyle('password'), paddingRight: '44px' }}
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused('')}
              />
              <button type="button" onClick={() => setShowPass(!showPass)} style={{
                position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '16px', padding: 0,
              }}>{showPass ? '🙈' : '👁️'}</button>
            </div>

            <div style={{ textAlign: 'right', marginBottom: '28px' }}>
              <Link href="/forgot-password" style={{ color: '#ff6600', fontSize: '13px', textDecoration: 'none', fontWeight: 500 }}>Forgot password?</Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%', padding: '13px',
                background: isLoading ? 'rgba(255,102,0,0.5)' : '#ff6600',
                border: 'none', borderRadius: '10px',
                color: '#fff', fontSize: '15px', fontWeight: 700,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s',
                boxShadow: '0 4px 20px rgba(255,102,0,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              }}
              onMouseEnter={e => { if (!isLoading) e.currentTarget.style.background = '#e55a00' }}
              onMouseLeave={e => { if (!isLoading) e.currentTarget.style.background = '#ff6600' }}
            >
              {isLoading ? (
                <>
                  <svg style={{ animation: 'spin 1s linear infinite', width: '18px', height: '18px' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </>
              ) : 'Sign In'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '24px', color: '#475569', fontSize: '13px' }}>
            Don't have an account?{' '}
            <Link href="/register" style={{ color: '#ff6600', textDecoration: 'none', fontWeight: 600 }}>Sign up</Link>
          </p>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
