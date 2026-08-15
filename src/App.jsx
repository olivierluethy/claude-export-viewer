import { useEffect } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useParser } from './lib/useParser.js'
import { ModelProvider } from './lib/ModelContext.jsx'
import UploadScreen from './components/UploadScreen.jsx'
import ParseProgress from './components/ParseProgress.jsx'
import ParseSummary from './components/ParseSummary.jsx'
import AppShell from './components/AppShell.jsx'
import ConversationsPage, { ConversationEmpty, ConversationRoute } from './pages/ConversationsPage.jsx'
import ProjectsPage, { ProjectRoute } from './pages/ProjectsPage.jsx'
import DesignChatsPage, { DesignChatRoute } from './pages/DesignChatsPage.jsx'
import ReflectionsPage from './pages/ReflectionsPage.jsx'
import MemoriesPage from './pages/MemoriesPage.jsx'
import SearchPage from './pages/SearchPage.jsx'
import ActivityPage from './pages/ActivityPage.jsx'
import GraphPage from './pages/GraphPage.jsx'

/** Restore the saved theme before first paint of the shell. */
function useTheme() {
  useEffect(() => {
    try {
      const saved = localStorage.getItem('cev-theme')
      if (saved) {
        document.documentElement.classList.toggle('light', saved === 'light')
        document.documentElement.classList.toggle('dark', saved !== 'light')
      }
    } catch {
      /* private mode */
    }
  }, [])
}


export default function App() {
  const { status, progress, model, error, cache, usage, parse, reset } = useParser()
  useTheme()

  if (status === 'booting')
    return <ParseProgress progress={{ label: 'Checking for a cached export', detail: 'reading local storage' }} />
  if (status === 'working') return <ParseProgress progress={progress} />
  if (status !== 'ready') return <UploadScreen onFiles={parse} error={error} />

  return (
    <ModelProvider model={model}>
      <HashRouter>
        <Routes>
          <Route element={<AppShell onReset={reset} />}>
            <Route
              index
              element={
                <div className="h-full overflow-y-auto">
                  <ParseSummary model={model} onReset={reset} cache={cache} usage={usage} />
                </div>
              }
            />
            <Route path="chats" element={<ConversationsPage />}>
              <Route index element={<ConversationEmpty />} />
              <Route path=":uuid" element={<ConversationRoute />} />
            </Route>
            <Route path="search" element={<SearchPage />} />
            <Route path="activity" element={<ActivityPage />} />
            <Route path="graph" element={<GraphPage />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="projects/:uuid" element={<ProjectRoute />} />
            <Route path="design" element={<DesignChatsPage />} />
            <Route path="design/:uuid" element={<DesignChatRoute />} />
            <Route path="reflections" element={<ReflectionsPage />} />
            <Route path="memories" element={<MemoriesPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </ModelProvider>
  )
}
