import { useState } from 'react'
import { TestLink } from './components/TestLink'
import { BulkTest } from './components/BulkTest'
import { BestResults } from './components/BestResults'
import { TestHistory } from './components/TestHistory'
import { Statistics } from './components/Statistics'
import { Utils } from './components/Utils'
import { Configuration } from './components/Configuration'
import { FiActivity, FiZap, FiTrendingUp, FiClock, FiBarChart2, FiSettings, FiEdit } from 'react-icons/fi'

type Tab = 'test' | 'bulk' | 'best' | 'history' | 'stats' | 'utils' | 'config'

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('test')

  const tabs = [
    { id: 'test' as Tab, label: 'Test Link', icon: FiZap },
    { id: 'bulk' as Tab, label: 'Bulk Test', icon: FiActivity },
    { id: 'best' as Tab, label: 'Best Results', icon: FiTrendingUp },
    { id: 'history' as Tab, label: 'History', icon: FiClock },
    { id: 'stats' as Tab, label: 'Statistics', icon: FiBarChart2 },
    { id: 'config' as Tab, label: 'Configuration', icon: FiEdit },
    { id: 'utils' as Tab, label: 'Utils', icon: FiSettings },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <FiZap className="h-8 w-8 text-primary-600 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">
                V2Ray Config Tester
              </h1>
            </div>
            <div className="text-sm text-gray-500">
              API: <span className="text-primary-600">http://localhost:8000</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <nav className="flex space-x-1 p-2" aria-label="Tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors
                    ${
                      activeTab === tab.id
                        ? 'bg-primary-100 text-primary-700'
                        : 'text-gray-600 hover:bg-gray-100'
                    }
                  `}
                >
                  <Icon className="h-5 w-5" />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </nav>
        </div>

        <main>
          {activeTab === 'test' && <TestLink />}
          {activeTab === 'bulk' && <BulkTest />}
          {activeTab === 'best' && <BestResults />}
          {activeTab === 'history' && <TestHistory />}
          {activeTab === 'stats' && <Statistics />}
          {activeTab === 'config' && <Configuration />}
          {activeTab === 'utils' && <Utils />}
        </main>
      </div>
    </div>
  )
}

export default App

