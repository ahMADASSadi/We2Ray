import { useState, useEffect } from 'react'
import { apiClient, ConfigResponse, ConfigUpdateRequest } from '../api/client'
import { FiSettings, FiLoader, FiRefreshCw, FiSave, FiCheckCircle, FiXCircle } from 'react-icons/fi'

export function Configuration() {
  const [config, setConfig] = useState<ConfigResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<string>('')

  const fetchConfig = async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const data = await apiClient.getConfig()
      setConfig(data)
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to fetch configuration')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchConfig()
  }, [])

  const handleUpdateField = async (key: keyof ConfigResponse, value: any) => {
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const updateRequest: ConfigUpdateRequest = { [key]: value }
      const updated = await apiClient.updateConfig(updateRequest)
      setConfig(updated)
      setSuccess(`Configuration '${key}' updated successfully!`)
      setEditingKey(null)
      setEditValue('')
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to update configuration')
    } finally {
      setSaving(false)
    }
  }

  const startEditing = (key: string, currentValue: any) => {
    setEditingKey(key)
    setEditValue(String(currentValue))
  }

  const cancelEditing = () => {
    setEditingKey(null)
    setEditValue('')
  }

  const saveEdit = () => {
    if (!editingKey || !config) return

    const key = editingKey as keyof ConfigResponse
    let value: any = editValue

    // Convert to appropriate type
    if (key === 'latency_threshold_ms' || key === 'test_timeout' || key === 'smtp_port') {
      value = parseInt(editValue)
      if (isNaN(value)) {
        setError(`Invalid number for ${key}`)
        return
      }
    }

    handleUpdateField(key, value)
  }

  if (loading) {
    return (
      <div className="card">
        <div className="flex items-center justify-center py-12">
          <FiLoader className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      </div>
    )
  }

  if (!config) {
    return (
      <div className="card">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">Failed to load configuration</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold flex items-center">
            <FiSettings className="h-6 w-6 mr-2 text-primary-600" />
            Configuration
          </h2>
          <button
            onClick={fetchConfig}
            disabled={loading || saving}
            className="btn btn-secondary flex items-center"
          >
            <FiRefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
            <FiXCircle className="h-5 w-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-800 font-medium">Error</p>
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start">
            <FiCheckCircle className="h-5 w-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-green-800 font-medium">Success</p>
              <p className="text-green-600 text-sm">{success}</p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {/* GitHub URL */}
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                GitHub Raw URL
              </label>
            </div>
            {editingKey === 'github_raw_url' ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="input"
                  placeholder="https://raw.githubusercontent.com/..."
                />
                <div className="flex space-x-2">
                  <button
                    onClick={saveEdit}
                    disabled={saving}
                    className="btn btn-primary text-sm"
                  >
                    {saving ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiSave className="h-4 w-4" />}
                    Save
                  </button>
                  <button
                    onClick={cancelEditing}
                    className="btn btn-secondary text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <code className="flex-1 text-sm font-mono bg-white p-2 rounded border border-gray-300 break-all">
                  {config.github_raw_url}
                </code>
                <button
                  onClick={() => startEditing('github_raw_url', config.github_raw_url)}
                  className="btn btn-secondary ml-2 text-sm"
                >
                  Edit
                </button>
              </div>
            )}
          </div>

          {/* Email Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              {editingKey === 'email_address' ? (
                <div className="space-y-2">
                  <input
                    type="email"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="input"
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={saveEdit}
                      disabled={saving}
                      className="btn btn-primary text-sm"
                    >
                      {saving ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiSave className="h-4 w-4" />}
                      Save
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="btn btn-secondary text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-sm">{config.email_address || 'Not set'}</span>
                  <button
                    onClick={() => startEditing('email_address', config.email_address)}
                    className="btn btn-secondary text-sm"
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>

            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Password
              </label>
              {editingKey === 'email_password' ? (
                <div className="space-y-2">
                  <input
                    type="password"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="input"
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={saveEdit}
                      disabled={saving}
                      className="btn btn-primary text-sm"
                    >
                      {saving ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiSave className="h-4 w-4" />}
                      Save
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="btn btn-secondary text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-sm">
                    {config.email_password ? '••••••••' : 'Not set'}
                  </span>
                  <button
                    onClick={() => startEditing('email_password', config.email_password)}
                    className="btn btn-secondary text-sm"
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>

            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Recipient Email
              </label>
              {editingKey === 'recipient_email' ? (
                <div className="space-y-2">
                  <input
                    type="email"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="input"
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={saveEdit}
                      disabled={saving}
                      className="btn btn-primary text-sm"
                    >
                      {saving ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiSave className="h-4 w-4" />}
                      Save
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="btn btn-secondary text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-sm">{config.recipient_email || 'Not set'}</span>
                  <button
                    onClick={() => startEditing('recipient_email', config.recipient_email)}
                    className="btn btn-secondary text-sm"
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>

            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                SMTP Server
              </label>
              {editingKey === 'smtp_server' ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="input"
                    placeholder="smtp.gmail.com"
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={saveEdit}
                      disabled={saving}
                      className="btn btn-primary text-sm"
                    >
                      {saving ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiSave className="h-4 w-4" />}
                      Save
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="btn btn-secondary text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-sm">{config.smtp_server}</span>
                  <button
                    onClick={() => startEditing('smtp_server', config.smtp_server)}
                    className="btn btn-secondary text-sm"
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Test Settings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-primary-50 rounded-lg border border-primary-200">
              <label className="block text-sm font-medium text-primary-700 mb-2">
                Latency Threshold (ms)
              </label>
              {editingKey === 'latency_threshold_ms' ? (
                <div className="space-y-2">
                  <input
                    type="number"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="input"
                    min="1"
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={saveEdit}
                      disabled={saving}
                      className="btn btn-primary text-sm"
                    >
                      {saving ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiSave className="h-4 w-4" />}
                      Save
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="btn btn-secondary text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-primary-900">
                    {config.latency_threshold_ms}ms
                  </span>
                  <button
                    onClick={() => startEditing('latency_threshold_ms', config.latency_threshold_ms)}
                    className="btn btn-secondary text-sm"
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>

            <div className="p-4 bg-primary-50 rounded-lg border border-primary-200">
              <label className="block text-sm font-medium text-primary-700 mb-2">
                Test Timeout (seconds)
              </label>
              {editingKey === 'test_timeout' ? (
                <div className="space-y-2">
                  <input
                    type="number"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="input"
                    min="1"
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={saveEdit}
                      disabled={saving}
                      className="btn btn-primary text-sm"
                    >
                      {saving ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiSave className="h-4 w-4" />}
                      Save
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="btn btn-secondary text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-primary-900">
                    {config.test_timeout}s
                  </span>
                  <button
                    onClick={() => startEditing('test_timeout', config.test_timeout)}
                    className="btn btn-secondary text-sm"
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>

            <div className="p-4 bg-primary-50 rounded-lg border border-primary-200">
              <label className="block text-sm font-medium text-primary-700 mb-2">
                SMTP Port
              </label>
              {editingKey === 'smtp_port' ? (
                <div className="space-y-2">
                  <input
                    type="number"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="input"
                    min="1"
                    max="65535"
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={saveEdit}
                      disabled={saving}
                      className="btn btn-primary text-sm"
                    >
                      {saving ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiSave className="h-4 w-4" />}
                      Save
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="btn btn-secondary text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-primary-900">
                    {config.smtp_port}
                  </span>
                  <button
                    onClick={() => startEditing('smtp_port', config.smtp_port)}
                    className="btn btn-secondary text-sm"
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Additional Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Subject
              </label>
              {editingKey === 'email_subject' ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="input"
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={saveEdit}
                      disabled={saving}
                      className="btn btn-primary text-sm"
                    >
                      {saving ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiSave className="h-4 w-4" />}
                      Save
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="btn btn-secondary text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-sm">{config.email_subject}</span>
                  <button
                    onClick={() => startEditing('email_subject', config.email_subject)}
                    className="btn btn-secondary text-sm"
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>

            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Test URL
              </label>
              {editingKey === 'test_url' ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="input"
                    placeholder="http://cp.cloudflare.com/"
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={saveEdit}
                      disabled={saving}
                      className="btn btn-primary text-sm"
                    >
                      {saving ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiSave className="h-4 w-4" />}
                      Save
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="btn btn-secondary text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <code className="flex-1 text-xs font-mono bg-white p-2 rounded border border-gray-300 break-all">
                    {config.test_url}
                  </code>
                  <button
                    onClick={() => startEditing('test_url', config.test_url)}
                    className="btn btn-secondary ml-2 text-sm"
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

