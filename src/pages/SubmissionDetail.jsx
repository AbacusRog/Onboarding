import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase, DOCUMENTS_BUCKET, SUBMISSIONS_TABLE } from "../lib/supabaseClient";
import RequireAuth from "./RequireAuth.jsx";

const SIGNED_URL_EXPIRY_SECONDS = 60 * 10; // 10 minutes

function Row({ label, value }) {
  if (!value) return null;
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value}</span>
    </div>
  );
}

function DetailContent() {
  const { id } = useParams();
  const [submission, setSubmission] = useState(null);
  const [error, setError] = useState("");
  const [links, setLinks] = useState({});

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from(SUBMISSIONS_TABLE)
        .select("*")
        .eq("id", id)
        .single();
      if (error) {
        setError(error.message);
        return;
      }
      setSubmission(data);

      const paths = {
        passport: data.passport_file_path,
        drivingLicence: data.driving_licence_file_path,
        addressProof: data.address_proof_file_path,
        taxReturn: data.tax_return_accounts_file_path,
        latestAccounts: data.latest_filed_accounts_file_path,
      };

      const entries = await Promise.all(
        Object.entries(paths).map(async ([key, path]) => {
          if (!path) return [key, null];
          const { data: signed } = await supabase.storage
            .from(DOCUMENTS_BUCKET)
            .createSignedUrl(path, SIGNED_URL_EXPIRY_SECONDS);
          return [key, signed?.signedUrl || null];
        })
      );
      setLinks(Object.fromEntries(entries));
    }
    load();
  }, [id]);

  if (error) {
    return (
      <div className="page">
        <div className="card">
          <p className="field-error field-error--form">{error}</p>
          <Link to="/admin">Back to list</Link>
        </div>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="page">
        <div className="card">Loading…</div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="card card--wide">
        <Link to="/admin" className="back-link">
          ← Back to list
        </Link>
        <h1>{submission.full_name}</h1>
        <p className="intro">Submitted {new Date(submission.created_at).toLocaleString()}</p>

        <section>
          <h2>Personal &amp; Business Information</h2>
          <Row label="Mobile Number" value={submission.mobile_number} />
          <Row label="Email Address" value={submission.email} />
          <Row label="Address Line 1" value={submission.address_line_1 || submission.address} />
          <Row label="Address Line 2" value={submission.address_line_2} />
          <Row label="Town / City" value={submission.town_city} />
          <Row label="County" value={submission.county} />
          <Row label="Postcode" value={submission.postcode} />
          <Row label="Date Moved into Address" value={submission.date_moved} />
          <Row label="Property Status" value={submission.property_status} />
          <Row label="Date of Birth" value={submission.date_of_birth} />
          <Row label="Nationality" value={submission.nationality} />
          <Row label="National Insurance Number" value={submission.ni_number} />
          <Row label="Personal UTR" value={submission.personal_utr} />
          <Row label="What They Do" value={submission.business_description} />
        </section>

        <section>
          <h2>Bank Details</h2>
          <Row label="Account Name" value={submission.bank_account_name} />
          <Row label="Sort Code" value={submission.bank_sort_code} />
          <Row label="Account Number" value={submission.bank_account_number} />
        </section>

        {submission.is_moving_accountant && (
          <section>
            <h2>Previous Accountant</h2>
            <Row label="Name" value={submission.previous_accountant_name} />
            <Row label="Email" value={submission.previous_accountant_email} />
          </section>
        )}

        {submission.is_limited_company && (
          <section>
            <h2>Limited Company</h2>
            <Row label="Company Name" value={submission.company_name} />
            <Row label="Company Number" value={submission.company_number} />
            <Row label="Authentication Code" value={submission.company_auth_code} />
            <Row label="Company UTR" value={submission.company_utr} />
          </section>
        )}

        <section>
          <h2>Documents</h2>
          {links.passport ? (
            <p>
              <a href={links.passport} target="_blank" rel="noreferrer">
                Passport photo page →
              </a>
            </p>
          ) : (
            <p className="field-hint">No passport uploaded.</p>
          )}
          {links.drivingLicence ? (
            <p>
              <a href={links.drivingLicence} target="_blank" rel="noreferrer">
                Driving licence →
              </a>
            </p>
          ) : (
            <p className="field-hint">No driving licence uploaded.</p>
          )}
          {links.addressProof ? (
            <p>
              <a href={links.addressProof} target="_blank" rel="noreferrer">
                Proof of address →
              </a>
            </p>
          ) : (
            <p className="field-hint">No proof of address uploaded.</p>
          )}
          {links.taxReturn && (
            <p>
              <a href={links.taxReturn} target="_blank" rel="noreferrer">
                Last Tax Return and Accounts →
              </a>
            </p>
          )}
          {links.latestAccounts && (
            <p>
              <a href={links.latestAccounts} target="_blank" rel="noreferrer">
                Latest Filed Accounts (company) →
              </a>
            </p>
          )}
          <p className="field-hint">Links expire 10 minutes after this page loads.</p>
        </section>
      </div>
    </div>
  );
}

export default function SubmissionDetail() {
  return (
    <RequireAuth>
      <DetailContent />
    </RequireAuth>
  );
}
