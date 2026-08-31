import { Routes, Route, Navigate } from "react-router-dom";

import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import People from "./pages/People";
import PersonReport from "./pages/PersonReport";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import Admin from "./pages/Admin";

function OfficePage({ children }) {
  return (
    <ProtectedRoute role="office">
      <Layout>{children}</Layout>
    </ProtectedRoute>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/Login" element={<Login />} />
      <Route path="/" element={<Navigate to="/Login" replace />} />

      <Route
        path="/admin"
        element={
          <ProtectedRoute role="admin">
            <Layout>
              <Admin />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route path="/dashboard" element={<OfficePage><Dashboard /></OfficePage>} />
      <Route path="/people" element={<OfficePage><People /></OfficePage>} />
      <Route path="/people/:id/report" element={<OfficePage><PersonReport /></OfficePage>} />
      <Route path="/reports" element={<OfficePage><Reports /></OfficePage>} />
      <Route path="/settings" element={<OfficePage><Settings /></OfficePage>} />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
