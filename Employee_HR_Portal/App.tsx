
import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';
import Layout from './components/layout/Layout';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import SalaryHistory from './pages/SalaryHistory';
import Attendance from './pages/Attendance';
import Profile from './pages/Profile';
import LeaveManagement from './pages/LeaveManagement';
import DocumentCenter from './pages/DocumentCenter';
import Tasks from './pages/Tasks';
import Helpdesk from './pages/Helpdesk';
import NotFound from './pages/NotFound';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/salary" element={<SalaryHistory />} />
              <Route path="/leave" element={<LeaveManagement />} />
              <Route path="/attendance" element={<Attendance />} />
              <Route path="/documents" element={<DocumentCenter />} />
              <Route path="/helpdesk" element={<Helpdesk />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;
