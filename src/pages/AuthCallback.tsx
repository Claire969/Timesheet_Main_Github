import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export const AuthCallback = () => {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search)
      const err = params.get('error') || params.get('error_code')
      const errDesc = params.get('error_description')

      if (err || errDesc) {
        setError(decodeURIComponent(errDesc || err || 'Erreur OAuth'))
        return
      }

      // ✅ Si Supabase a déjà créé la session automatiquement, on sort proprement
      const { data: preData } = await supabase.auth.getSession()
      if (preData.session) {
        sessionStorage.removeItem('force_msal_prompt')
        window.history.replaceState({}, document.title, '/')
        navigate('/', { replace: true })
        return
      }

      const code = params.get('code')
      if (!code) {
        setError("Code OAuth manquant dans l'URL (paramètre ?code=...)")
        return
      }

      // Anti double-run (StrictMode/dev)
      const onceKey = `oauth:used:${code}`
      if (sessionStorage.getItem(onceKey)) {
        navigate('/', { replace: true })
        return
      }
      sessionStorage.setItem(onceKey, '1')

      const { error } = await supabase.auth.exchangeCodeForSession(code)

      if (error) {
        // 🔁 Si l'échange a déjà été fait ailleurs, on re-check la session avant d'afficher une erreur
        const { data: postData } = await supabase.auth.getSession()
        if (postData.session) {
          sessionStorage.removeItem('force_msal_prompt')
          window.history.replaceState({}, document.title, '/')
          navigate('/', { replace: true })
          return
        }

        setError(error.message)
        return
      }

      sessionStorage.removeItem('force_msal_prompt')
      window.history.replaceState({}, document.title, '/')
      navigate('/', { replace: true })
    }

    void run()
  }, [navigate])

  return (
    <div style={{ padding: 24 }}>
      <h1>Authentification</h1>
      {error ? (
        <>
          <p style={{ color: 'crimson' }}>{error}</p>
          <a href="/login">Retour à la connexion</a>
        </>
      ) : (
        <p>Connexion en cours…</p>
      )}
    </div>
  )
}
