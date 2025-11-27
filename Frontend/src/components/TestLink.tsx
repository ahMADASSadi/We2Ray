import { useState } from 'react'
import { apiClient, LinkTestResponse } from '../api/client'
import { FiZap, FiLoader, FiCheckCircle, FiXCircle, FiCopy } from 'react-icons/fi'

export function TestLink() {
  const [link, setLink] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<LinkTestResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleTest = async () => {
    if (!link.trim()) {
      setError('Please enter a VPN link')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await apiClient.testLink({ link: link.trim() })
      setResult(response)
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to test link')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-2xl font-bold mb-4 flex items-center">
          <FiZap className="h-6 w-6 mr-2 text-primary-600" />
          Test Single Link
        </h2>
        <p className="text-gray-600 mb-6">
          Test a single VPN configuration link (VMESS, VLESS, SS, Trojan, etc.)
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              VPN Configuration Link
            </label>
            <textarea
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="vmess://eyJhZGQiOiI4NS4xOTUuMTAxLjEyMiIs..."
              className="input min-h-[120px] font-mono text-sm"
            />
          </div>

          <button
            onClick={handleTest}
            disabled={loading}
            className="btn btn-primary w-full sm:w-auto flex items-center justify-center"
          >
            {loading ? (
              <>
                <FiLoader className="h-5 w-5 mr-2 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <FiZap className="h-5 w-5 mr-2" />
                Test Link
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
            <FiXCircle className="h-5 w-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-800 font-medium">Error</p>
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          </div>
        )}

        {result && (
          <div className="mt-6 p-6 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center">
                {result.success ? (
                  <>
                    <FiCheckCircle className="h-5 w-5 text-green-600 mr-2" />
                    Test Successful
                  </>
                ) : (
                  <>
                    <FiXCircle className="h-5 w-5 text-red-600 mr-2" />
                    Test Failed
                  </>
                )}
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Protocol</p>
                <p className="font-medium">{result.protocol || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Host</p>
                <p className="font-medium">{result.host || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Port</p>
                <p className="font-medium">{result.port || 'N/A'}</p>
              </div>
              {result.latency_ms && (
                <div>
                  <p className="text-sm text-gray-600">Latency</p>
                  <p className="font-medium text-primary-600">
                    {result.latency_ms.toFixed(2)} ms
                  </p>
                </div>
              )}
            </div>

            {result.error && (
              <div className="mt-4">
                <p className="text-sm text-gray-600">Error</p>
                <p className="text-red-600">{result.error}</p>
              </div>
            )}

            <div className="mt-4">
              <p className="text-sm text-gray-600 mb-2">Link</p>
              <div className="flex items-center space-x-2">
                <code className="flex-1 p-2 bg-white border border-gray-300 rounded text-xs font-mono break-all">
                  {result.link}
                </code>
                <button
                  onClick={() => copyToClipboard(result.link)}
                  className="btn btn-secondary p-2"
                  title="Copy link"
                >
                  <FiCopy className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

