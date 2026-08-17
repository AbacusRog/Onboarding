import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase, SUBMISSIONS_TABLE } from "../lib/supabaseClient";
import RequireAuth from "./RequireAuth.jsx";

function DashboardContent() {
  const [submissions, setSubmissions] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from(SUBMISSIONS_TABLE)
        .select("id, created_at, full_name, is_limited_company, company_name")
        .order("created_at", { ascending: false });
      if (error) setError(error.message);
      else setSubmissions(data);
    }
    load();
  }, []);

  return (
    <div className="page">
      <div className="card card--wide">
        <div className="dashboard-header">
          <h1>Client Submissions</h1>
          <button className="link-button" onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
        </div>

        {error && <p className="field-error field-error--form">{error}</p>}

        {submissions === null && !error && <p>Loading…</p>}

        {submissions?.length === 0 && <p>No submissions yet.</p>}

        {submissions && submissions.length > 0 && (
          <table className="submissions-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Submitted</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((s) => (
                <tr key={s.id}>
                  <td>{s.full_name}</td>
                  <td>{s.is_limited_company ? s.company_name || "Limited company" : "Individual"}</td>
                  <td>{new Date(s.created_at).toLocaleString()}</td>
                  <td>
                    <Link to={`/admin/${s.id}`}>View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <RequireAuth>
      <DashboardContent />
    </RequireAuth>
  );
}
