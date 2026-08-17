import { Routes, Route, Link } from "react-router-dom";
import OnboardingForm from "./pages/OnboardingForm.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import SubmissionDetail from "./pages/SubmissionDetail.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<OnboardingForm />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/admin/:id" element={<SubmissionDetail />} />
      <Route
        path="*"
        element={
          <div style={{ padding: 40 }}>
            <p>Page not found.</p>
            <Link to="/">Go home</Link>
          </div>
        }
      />
    </Routes>
  );
}
