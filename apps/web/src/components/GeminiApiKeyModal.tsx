import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { saveGeminiKey } from '../lib/api'

export function GeminiApiKeyModal() {
  const [apiKey, setApiKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const qc = useQueryClient()

  const saveMutation = useMutation({
    mutationFn: async (key: string) => {
      const res = await saveGeminiKey(key)
      return res
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me'] })
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to save API key. Please try again.')
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const key = apiKey.trim()
    if (!key) {
      setError('API key is required')
      return
    }
    if (!key.startsWith('AIza') && !key.startsWith('AQ.')) {
      setError('Invalid API key format. Should start with AIza or AQ.')
      return
    }
    saveMutation.mutate(key)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div 
        className="w-full max-w-md rounded-xl p-6 shadow-2xl relative"
        style={{
          background: '#161B22',
          border: '1px solid #30363D'
        }}
      >
        <h2 className="text-xl font-bold mb-4" style={{ color: '#E6EDF3' }}>
          Google AI Studio Key Required
        </h2>
        
        <p className="text-sm mb-4 leading-relaxed" style={{ color: '#8B949E' }}>
          GitReport uses Gemini to generate your personalized developer narratives. 
          To unlock AI-powered features, please provide your personal Google AI Studio API key.
        </p>

        <div className="mb-6 rounded-md p-4 text-sm" style={{ background: '#0D1117', border: '1px solid #30363D' }}>
          <h3 className="font-semibold mb-2" style={{ color: '#E6EDF3' }}>How to get a key:</h3>
          <ol className="list-decimal pl-4 space-y-2" style={{ color: '#8B949E' }}>
            <li>
              Go to <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">Google AI Studio</a>.
            </li>
            <li>Sign in with your Google account.</li>
            <li>Click <strong>"Create API key"</strong>.</li>
            <li>Copy the generated key and paste it below.</li>
          </ol>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="apiKey" className="block text-sm font-medium mb-1" style={{ color: '#E6EDF3' }}>
              Gemini API Key
            </label>
            <input
              id="apiKey"
              type="password"
              placeholder="AIzaSy..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full px-3 py-2 rounded-md outline-none focus:ring-1 focus:ring-blue-500"
              style={{
                background: '#0D1117',
                border: '1px solid #30363D',
                color: '#E6EDF3'
              }}
              disabled={saveMutation.isPending}
            />
          </div>

          {error && (
            <div className="text-sm text-red-400 p-2 rounded-md" style={{ background: 'rgba(248, 81, 73, 0.1)', border: '1px solid rgba(248, 81, 73, 0.4)' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="w-full py-2 px-4 rounded-md font-medium transition-colors disabled:opacity-50"
            style={{
              background: '#238636',
              color: '#ffffff',
              border: '1px solid rgba(240, 246, 252, 0.1)'
            }}
          >
            {saveMutation.isPending ? 'Saving...' : 'Save API Key & Continue'}
          </button>
        </form>
      </div>
    </div>
  )
}
