import { useState, useEffect } from 'react'
import { apiClient, Statistics as StatisticsType } from '../api/client'
import { FiBarChart2, FiLoader, FiRefreshCw, FiTrendingUp, FiActivity, FiCheckCircle, FiXCircle } from 'react-icons/fi'

export function Statistics() {
  const [stats, setStats] = useState<StatisticsType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await apiClient.getStatistics()
      setStats(data)
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to fetch statistics')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  if (loading) {
    return (
      <div className="card">
        <div className="flex items-center justify-center py-12">
          <FiLoader className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{error}</p>
        </div>
      </div>
    )
  }

  if (!stats) return null

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold flex items-center">
            <FiBarChart2 className="h-6 w-6 mr-2 text-primary-600" />
            Statistics
          </h2>
          <button onClick={fetchStats} className="btn btn-secondary flex items-center">
            <FiRefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="p-6 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <FiActivity className="h-5 w-5 text-blue-600" />
            </div>
            <p className="text-sm text-blue-700 mb-1">Total Tests</p>
            <p className="text-3xl font-bold text-blue-900">{stats.total_tests}</p>
          </div>

          <div className="p-6 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center justify-between mb-2">
              <FiCheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <p className="text-sm text-green-700 mb-1">Successful</p>
            <p className="text-3xl font-bold text-green-900">{stats.successful_tests}</p>
          </div>

          <div className="p-6 bg-red-50 rounded-lg border border-red-200">
            <div className="flex items-center justify-between mb-2">
              <FiXCircle className="h-5 w-5 text-red-600" />
            </div>
            <p className="text-sm text-red-700 mb-1">Failed</p>
            <p className="text-3xl font-bold text-red-900">{stats.failed_tests}</p>
          </div>

          <div className="p-6 bg-primary-50 rounded-lg border border-primary-200">
            <div className="flex items-center justify-between mb-2">
              <FiTrendingUp className="h-5 w-5 text-primary-600" />
            </div>
            <p className="text-sm text-primary-700 mb-1">Success Rate</p>
            <p className="text-3xl font-bold text-primary-900">
              {stats.success_rate.toFixed(1)}%
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {stats.average_latency_ms && (
            <div className="p-6 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-600 mb-1">Average Latency</p>
              <p className="text-2xl font-bold">{stats.average_latency_ms.toFixed(2)} ms</p>
            </div>
          )}

          {stats.best_latency_ms && (
            <div className="p-6 bg-primary-50 rounded-lg border border-primary-200">
              <p className="text-sm text-primary-700 mb-1">Best Latency</p>
              <p className="text-2xl font-bold text-primary-900">
                {stats.best_latency_ms.toFixed(2)} ms
              </p>
            </div>
          )}
        </div>

        <div className="p-6 bg-white rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Protocol Distribution</h3>
          <div className="space-y-3">
            {Object.entries(stats.protocol_distribution).map(([protocol, count]) => {
              const percentage = (count / stats.total_tests) * 100
              return (
                <div key={protocol}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{protocol.toUpperCase()}</span>
                    <span className="text-sm text-gray-600">
                      {count} ({percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-primary-600 h-2 rounded-full"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="p-6 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-600 mb-1">Best Results Stored</p>
          <p className="text-2xl font-bold">{stats.best_results_count}</p>
        </div>
      </div>
    </div>
  )
}

