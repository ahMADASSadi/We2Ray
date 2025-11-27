import { useState, useEffect } from 'react'
import { apiClient, BestResult } from '../api/client'
import { FiTrendingUp, FiLoader, FiCopy, FiTrash2, FiRefreshCw } from 'react-icons/fi'
import { format } from 'date-fns'

export function BestResults() {
  const [results, setResults] = useState<BestResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [limit, setLimit] = useState(20)
  const [protocol, setProtocol] = useState('')
  const [maxLatency, setMaxLatency] = useState('')

  const fetchResults = async () => {
    setLoading(true)
    setError(null)

    try {
      const params: any = { limit }
      if (protocol) params.protocol = protocol
      if (maxLatency) params.max_latency = parseFloat(maxLatency)

      const data = await apiClient.getBestResults(params)
      setResults(data)
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to fetch results')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchResults()
  }, [limit, protocol, maxLatency])

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this result?')) return

    try {
      await apiClient.deleteBestResult(id)
      fetchResults()
    } catch (err: any) {
      alert(err.response?.data?.detail || err.message || 'Failed to delete')
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold flex items-center">
            <FiTrendingUp className="h-6 w-6 mr-2 text-primary-600" />
            Best Results
          </h2>
          <button
            onClick={fetchResults}
            disabled={loading}
            className="btn btn-secondary flex items-center"
          >
            <FiRefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Limit</label>
            <input
              type="number"
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value) || 20)}
              min="1"
              max="100"
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Protocol</label>
            <select
              value={protocol}
              onChange={(e) => setProtocol(e.target.value)}
              className="input"
            >
              <option value="">All</option>
              <option value="vmess">VMESS</option>
              <option value="vless">VLESS</option>
              <option value="ss">SS</option>
              <option value="trojan">Trojan</option>
              <option value="hysteria2">Hysteria2</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Max Latency (ms)
            </label>
            <input
              type="number"
              value={maxLatency}
              onChange={(e) => setMaxLatency(e.target.value)}
              placeholder="e.g., 100"
              className="input"
            />
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <FiLoader className="h-8 w-8 animate-spin text-primary-600" />
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No results found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Rank
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Protocol
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Host:Port
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Latency
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Test Count
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Last Updated
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {results.map((result, idx) => (
                  <tr key={result.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium">#{idx + 1}</td>
                    <td className="px-4 py-3 text-sm">{result.protocol}</td>
                    <td className="px-4 py-3 text-sm font-mono">
                      {result.host}:{result.port}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-primary-600">
                      {result.latency_ms.toFixed(2)} ms
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{result.test_count}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {format(new Date(result.last_updated), 'MMM d, yyyy HH:mm')}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => copyToClipboard(result.original_link)}
                          className="btn btn-secondary p-1.5"
                          title="Copy link"
                        >
                          <FiCopy className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(result.id)}
                          className="btn btn-danger p-1.5"
                          title="Delete"
                        >
                          <FiTrash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

