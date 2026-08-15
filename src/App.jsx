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
import ReviewPage from './pages/ReviewPage.jsx'
import { useDateFormat } from './lib/prefs.js'

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
  const dateFormat = useDateFormat()
  useTheme()

  if (status === 'booting')
    return <ParseProgress progress={{ label: 'Checking for a cached export', detail: 'reading local storage' }} />
  if (status === 'working') return <ParseProgress progress={progress} />
  if (status !== 'ready') return <UploadScreen onFiles={parse} error={error} />

  return (
    <ModelProvider model={model}>
      {/* Keyed on the date format so memoised rows re-render when it changes.
          ModelProvider stays mounted above it, so the search indexes survive. */}
      <HashRouter key={dateFormat}>
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
            <Route path="review" element={<ReviewPage />} />
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
