import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

export interface LinkTestRequest {
  link: string
  test_url?: string
}

export interface LinkTestResponse {
  success: boolean
  link: string
  protocol?: string
  host?: string
  port?: string
  latency_ms?: number
  error?: string
}

export interface BulkTestRequest {
  links: string[]
  test_url?: string
  save_to_db?: boolean
}

export interface BulkTestResponse {
  total_tested: number
  successful: number
  failed: number
  results: LinkTestResponse[]
  best_result?: LinkTestResponse
}

export interface BestResult {
  id: number
  protocol: string
  host: string
  port: string
  latency_ms: number
  original_link: string
  first_seen: string
  last_updated: string
  test_count: number
}

export interface TestHistory {
  id: number
  timestamp: string
  protocol: string
  host: string
  port: string
  latency_ms?: number
  original_link: string
  status: string
}

export interface Statistics {
  total_tests: number
  successful_tests: number
  failed_tests: number
  success_rate: number
  average_latency_ms?: number
  best_latency_ms?: number
  protocol_distribution: Record<string, number>
  best_results_count: number
}

export interface UtilsResponse {
  utilities: Record<string, any>
  commands: Record<string, any>
  configuration: Record<string, any>
}

export interface ConfigResponse {
  github_raw_url: string
  email_address: string
  email_password: string
  recipient_email: string
  latency_threshold_ms: number
  test_timeout: number
  smtp_server: string
  smtp_port: number
  email_subject: string
  test_url: string
}

export interface ConfigUpdateRequest {
  github_raw_url?: string
  email_address?: string
  email_password?: string
  recipient_email?: string
  latency_threshold_ms?: number
  test_timeout?: number
  smtp_server?: string
  smtp_port?: number
  email_subject?: string
  test_url?: string
}

export const apiClient = {
  testLink: async (request: LinkTestRequest): Promise<LinkTestResponse> => {
    const { data } = await api.post<LinkTestResponse>('/test/link', request)
    return data
  },

  testBulk: async (request: BulkTestRequest): Promise<BulkTestResponse> => {
    const { data } = await api.post<BulkTestResponse>('/test/bulk', request)
    return data
  },

  testGitHub: async (): Promise<BulkTestResponse> => {
    const { data } = await api.post<BulkTestResponse>('/test/github')
    return data
  },

  getBestResults: async (params?: {
    limit?: number
    protocol?: string
    max_latency?: number
  }): Promise<BestResult[]> => {
    const { data } = await api.get<BestResult[]>('/results/best', { params })
    return data
  },

  getHistory: async (params?: {
    limit?: number
    protocol?: string
  }): Promise<TestHistory[]> => {
    const { data } = await api.get<TestHistory[]>('/results/history', { params })
    return data
  },

  getStatistics: async (): Promise<Statistics> => {
    const { data } = await api.get<Statistics>('/results/stats')
    return data
  },

  getUtils: async (): Promise<UtilsResponse> => {
    const { data } = await api.get<UtilsResponse>('/utils')
    return data
  },

  deleteBestResult: async (id: number): Promise<void> => {
    await api.delete(`/results/best/${id}`)
  },

  getConfig: async (): Promise<ConfigResponse> => {
    const { data } = await api.get<ConfigResponse>('/config')
    return data
  },

  updateConfig: async (request: ConfigUpdateRequest): Promise<ConfigResponse> => {
    const { data } = await api.put<ConfigResponse>('/config', request)
    return data
  },

  updateConfigKey: async (key: string, value: any): Promise<{ message: string; key: string; value: any; updated_at: string }> => {
    const { data } = await api.put(`/config/${key}`, { value })
    return data
  },
}

