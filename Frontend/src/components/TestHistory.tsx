import { useState, useEffect } from 'react'
import { apiClient, TestHistory as TestHistoryType } from '../api/client'
import { FiClock, FiLoader, FiRefreshCw, FiCheckCircle, FiXCircle } from 'react-icons/fi'
import { format } from 'date-fns'

export function TestHistory() {
  const [history, setHistory] = useState<TestHistoryType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [limit, setLimit] = useState(50)
  const [protocol, setProtocol] = useState('')

  const fetchHistory = async () => {
    setLoading(true)
    setError(null)

    try {
      const params: any = { limit }
      if (protocol) params.protocol = protocol

      const data = await apiClient.getHistory(params)
      setHistory(data)
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to fetch history')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHistory()
  }, [limit, protocol])

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold flex items-center">
            <FiClock className="h-6 w-6 mr-2 text-primary-600" />
            Test History
          </h2>
          <button
            onClick={fetchHistory}
            disabled={loading}
            className="btn btn-secondary flex items-center"
          >
            <FiRefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Limit</label>
            <input
              type="number"
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value) || 50)}
              min="1"
              max="1000"
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
        ) : history.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No history found</div>
        ) : (
          <div className="space-y-2">
            {history.map((item) => (
              <div
                key={item.id}
                className={`p-4 rounded-lg border ${
                  item.status === 'success'
                    ? 'bg-green-50 border-green-200'
                    : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      {item.status === 'success' ? (
                        <FiCheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <FiXCircle className="h-5 w-5 text-red-600" />
                      )}
                      <span className="font-medium">{item.protocol}</span>
                      <span className="text-sm text-gray-600">
                        {item.host}:{item.port}
                      </span>
                      {item.latency_ms && (
                        <span className="text-sm font-medium text-primary-600">
                          {item.latency_ms.toFixed(2)}ms
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 font-mono break-all mb-1">
                      {item.original_link}
                    </p>
                    <p className="text-xs text-gray-500">
                      {format(new Date(item.timestamp), 'MMM d, yyyy HH:mm:ss')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

