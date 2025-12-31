import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { HomePage } from './pages/HomePage';
import { ReviewPage } from './pages/ReviewPage';
import { StagedChangesPage } from './pages/StagedChangesPage';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="staged" element={<StagedChangesPage />} />
        <Route path="reviews/:id" element={<ReviewPage />} />
      </Route>
    </Routes>
  );
}
