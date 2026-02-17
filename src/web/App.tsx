import { Routes, Route } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { HighlighterProvider } from './contexts/HighlighterContext'
import { SettingsProvider } from './contexts/SettingsContext'
import { FontApplier } from './components/FontApplier'
import { HomePage } from './pages/HomePage'
import { ReviewPage } from './pages/ReviewPage'
import { StagedChangesPage } from './pages/StagedChangesPage'
import { NewReviewPage } from './pages/NewReviewPage'

export function App () {
  return (
    <SettingsProvider>
      <FontApplier />
      <HighlighterProvider>
        <Routes>
          <Route path='/' element={<Layout />}>
            <Route index element={<StagedChangesPage />} />
            <Route path='new' element={<NewReviewPage />} />
            <Route path='reviews' element={<HomePage />} />
            <Route path='reviews/:id' element={<ReviewPage />} />
          </Route>
        </Routes>
      </HighlighterProvider>
    </SettingsProvider>
  )
}
