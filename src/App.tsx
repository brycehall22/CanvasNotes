// src/App.tsx
// Root router. Two routes: dashboard at /, single board at /board/:id.

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Dashboard } from './routes/Dashboard';
import { Board } from './routes/Board';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/board/:id" element={<Board />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
