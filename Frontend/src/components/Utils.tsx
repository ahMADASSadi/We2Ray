import { useState, useEffect } from 'react'
import { apiClient, UtilsResponse } from '../api/client'
import { FiSettings, FiLoader, FiRefreshCw, FiCode, FiCheckCircle } from 'react-icons/fi'

export function Utils() {
  const [utils, setUtils] = useState<UtilsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchUtils = async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await apiClient.getUtils()
      setUtils(data)
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to fetch utilities')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUtils()
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

  if (!utils) return null

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold flex items-center">
            <FiSettings className="h-6 w-6 mr-2 text-primary-600" />
            Utilities & Configuration
          </h2>
          <button onClick={fetchUtils} className="btn btn-secondary flex items-center">
            <FiRefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <FiCode className="h-5 w-5 mr-2 text-primary-600" />
              Available Utilities
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(utils.utilities).map(([key, value]) => (
                <div key={key} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h4 className="font-medium mb-2 capitalize">{key.replace(/_/g, ' ')}</h4>
                  {typeof value === 'object' ? (
                    <div className="text-sm text-gray-600 space-y-1">
                      {Object.entries(value).map(([k, v]) => (
                        <div key={k}>
                          <span className="font-medium">{k}:</span>{' '}
                          {Array.isArray(v) ? v.join(', ') : String(v)}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600">{String(value)}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">Current Configuration</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(utils.configuration).map(([key, value]) => (
                <div key={key} className="p-4 bg-primary-50 rounded-lg border border-primary-200">
                  <p className="text-sm text-primary-700 mb-1 capitalize">
                    {key.replace(/_/g, ' ')}
                  </p>
                  <p className="font-medium text-primary-900">{String(value)}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <FiCheckCircle className="h-5 w-5 mr-2 text-green-600" />
              Available Commands
            </h3>
            <div className="space-y-3">
              {Object.entries(utils.commands).map(([endpoint, details]: [string, any]) => (
                <div key={endpoint} className="p-4 bg-white rounded-lg border border-gray-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-primary-600 mb-1">{endpoint}</h4>
                      <p className="text-sm text-gray-600 mb-2">{details.description}</p>
                      {details.request_body && (
                        <div className="text-xs text-gray-500">
                          <p className="font-medium mb-1">Request Body:</p>
                          <pre className="bg-gray-50 p-2 rounded">
                            {JSON.stringify(details.request_body, null, 2)}
                          </pre>
                        </div>
                      )}
                      {details.query_params && (
                        <div className="text-xs text-gray-500 mt-2">
                          <p className="font-medium mb-1">Query Parameters:</p>
                          <pre className="bg-gray-50 p-2 rounded">
                            {JSON.stringify(details.query_params, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

