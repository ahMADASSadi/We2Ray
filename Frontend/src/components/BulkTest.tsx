import { useState } from 'react'
import { apiClient, BulkTestResponse } from '../api/client'
import { FiActivity, FiLoader, FiCheckCircle, FiXCircle, FiCopy } from 'react-icons/fi'
import { FaGithub } from 'react-icons/fa'

export function BulkTest() {
  const [links, setLinks] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<BulkTestResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleBulkTest = async () => {
    const linkList = links
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)

    if (linkList.length === 0) {
      setError('Please enter at least one VPN link')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await apiClient.testBulk({ links: linkList, save_to_db: true })
      setResult(response)
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to test links')
    } finally {
      setLoading(false)
    }
  }

  const handleGitHubTest = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await apiClient.testGitHub()
      setResult(response)
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to test GitHub links')
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
          <FiActivity className="h-6 w-6 mr-2 text-primary-600" />
          Bulk Test Links
        </h2>
        <p className="text-gray-600 mb-6">
          Test multiple VPN configuration links at once. Enter one link per line.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              VPN Configuration Links (one per line)
            </label>
            <textarea
              value={links}
              onChange={(e) => setLinks(e.target.value)}
              placeholder="vmess://eyJhZGQiOiI4NS4xOTUuMTAxLjEyMiIs...&#10;vless://uuid@host:port?...&#10;ss://..."
              className="input min-h-[200px] font-mono text-sm"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleBulkTest}
              disabled={loading}
              className="btn btn-primary flex items-center justify-center"
            >
            {loading ? (
              <>
                <FiLoader className="h-5 w-5 mr-2 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <FiActivity className="h-5 w-5 mr-2" />
                Test Links
              </>
            )}
            </button>

            <button
              onClick={handleGitHubTest}
              disabled={loading}
              className="btn btn-secondary flex items-center justify-center"
            >
            {loading ? (
              <>
                <FiLoader className="h-5 w-5 mr-2 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <FaGithub className="h-5 w-5 mr-2" />
                Test from GitHub
              </>
            )}
            </button>
          </div>
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
          <div className="mt-6 space-y-4">
            <div className="p-6 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="text-lg font-semibold mb-4">Test Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Total Tested</p>
                  <p className="text-2xl font-bold">{result.total_tested}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Successful</p>
                  <p className="text-2xl font-bold text-green-600">{result.successful}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Failed</p>
                  <p className="text-2xl font-bold text-red-600">{result.failed}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Success Rate</p>
                  <p className="text-2xl font-bold text-primary-600">
                    {((result.successful / result.total_tested) * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>

            {result.best_result && (
              <div className="p-6 bg-primary-50 rounded-lg border border-primary-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold flex items-center text-primary-800">
                    <FiCheckCircle className="h-5 w-5 mr-2" />
                    Best Result
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-primary-700">Protocol</p>
                    <p className="font-medium">{result.best_result.protocol}</p>
                  </div>
                  <div>
                    <p className="text-sm text-primary-700">Host:Port</p>
                    <p className="font-medium">
                      {result.best_result.host}:{result.best_result.port}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-primary-700">Latency</p>
                    <p className="font-medium text-primary-600">
                      {result.best_result.latency_ms?.toFixed(2)} ms
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <code className="flex-1 p-2 bg-white border border-primary-300 rounded text-xs font-mono break-all">
                      {result.best_result.link.substring(0, 50)}...
                    </code>
                      <button
                        onClick={() => copyToClipboard(result.best_result!.link)}
                        className="btn btn-secondary p-2"
                        title="Copy link"
                      >
                        <FiCopy className="h-4 w-4" />
                      </button>
                  </div>
                </div>
              </div>
            )}

            <div className="p-6 bg-white rounded-lg border border-gray-200">
              <h3 className="text-lg font-semibold mb-4">All Results</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {result.results.map((r, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded border ${
                      r.success
                        ? 'bg-green-50 border-green-200'
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          {r.success ? (
                            <FiCheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <FiXCircle className="h-4 w-4 text-red-600" />
                          )}
                          <span className="font-medium">{r.protocol}</span>
                          <span className="text-sm text-gray-600">
                            {r.host}:{r.port}
                          </span>
                          {r.latency_ms && (
                            <span className="text-sm font-medium text-primary-600">
                              {r.latency_ms.toFixed(2)}ms
                            </span>
                          )}
                        </div>
                        {r.error && (
                          <p className="text-xs text-red-600 mt-1">{r.error}</p>
                        )}
                      </div>
                      <button
                        onClick={() => copyToClipboard(r.link)}
                        className="btn btn-secondary p-1.5 ml-2"
                        title="Copy link"
                      >
                        <FiCopy className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

