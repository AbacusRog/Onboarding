import { useState } from "react";
import { supabase, DOCUMENTS_BUCKET, SUBMISSIONS_TABLE } from "../lib/supabaseClient";
import PostcodeLookup from "../components/PostcodeLookup.jsx";

const ACCEPTED_FILE_TYPES = "image/*,application/pdf";
const MAX_FILE_SIZE_MB = 10;

// UTR: exactly 10 digits
const UTR_PATTERN = /^\d{10}$/;
// NI number: LLNNNNNNL, with HMRC's actual letter rules —
//   1st letter: not D, F, I, Q, U, V
//   2nd letter: not D, F, I, O, Q, U, V
//   prefix (both letters together): not BG, GB, NK, KN, TN, NT, ZZ
//   suffix: A, B, C, or D
const NI_NUMBER_PATTERN =
  /^(?!BG)(?!GB)(?!NK)(?!KN)(?!TN)(?!NT)(?!ZZ)[A-CEGHJ-PR-TW-Z][A-CEGHJ-NPR-TW-Z]\d{6}[A-D]$/i;

const emptyForm = {
  full_name: "",
  mobile_number: "",
  email: "",
  address_line_1: "",
  address_line_2: "",
  town_city: "",
  county: "",
  postcode: "",
  date_moved: "",
  property_status: "",
  date_of_birth: "",
  nationality: "",
  ni_number: "",
  personal_utr: "",
  business_description: "",
  bank_account_name: "",
  bank_sort_code: "",
  bank_account_number: "",
  is_moving_accountant: false,
  previous_accountant_name: "",
  previous_accountant_email: "",
  is_limited_company: false,
  company_name: "",
  company_number: "",
  company_auth_code: "",
  company_utr: "",
};

function FileDrop({ label, hint, file, onChange, error }) {
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      {hint && <p className="field-hint">{hint}</p>}
      <label className={`file-drop ${file ? "file-drop--filled" : ""}`}>
        <input
          type="file"
          accept={ACCEPTED_FILE_TYPES}
          onChange={(e) => onChange(e.target.files?.[0] || null)}
        />
        {file ? (
          <span className="file-drop__filename">{file.name}</span>
        ) : (
          <span>Click to choose a file, or drag one here</span>
        )}
      </label>
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}

export default function OnboardingForm() {
  const [form, setForm] = useState(emptyForm);
  const [passportFile, setPassportFile] = useState(null);
  const [drivingLicenceFile, setDrivingLicenceFile] = useState(null);
  const [addressProofFile, setAddressProofFile] = useState(null);
  const [taxReturnFile, setTaxReturnFile] = useState(null);
  const [latestAccountsFile, setLatestAccountsFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function validateOnBlur(field, value) {
    if (field === "personal_utr" || field === "company_utr") {
      if (value && !UTR_PATTERN.test(value)) {
        setFieldErrors((e) => ({ ...e, [field]: "UTR must be exactly 10 digits." }));
        return;
      }
    }
    if (field === "ni_number") {
      if (value && !NI_NUMBER_PATTERN.test(value)) {
        setFieldErrors((e) => ({
          ...e,
          [field]: "That doesn't look like a valid National Insurance number (e.g. AB123456C).",
        }));
        return;
      }
    }
    setFieldErrors((e) => {
      const next = { ...e };
      delete next[field];
      return next;
    });
  }

  function validateFile(file) {
    if (!file) return null;
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      return `File is too large (max ${MAX_FILE_SIZE_MB}MB).`;
    }
    return null;
  }

  async function uploadFile(submissionId, file, label, attempt = 1) {
    if (!file) return null;
    const ext = file.name.split(".").pop();
    const path = `${submissionId}/${label}.${ext}`;
    const { error } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .upload(path, file);
    if (error) {
      // Retry once after a short pause — covers transient/first-request hiccups
      // rather than failing the whole submission on a one-off blip.
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 800));
        return uploadFile(submissionId, file, label, attempt + 1);
      }
      throw new Error(`Failed to upload ${label}: ${error.message}`);
    }
    return path;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMessage("");

    if (!form.full_name || !form.address_line_1 || !form.town_city || !form.postcode) {
      setErrorMessage("Please fill in your name and address.");
      return;
    }
    if (!passportFile && !drivingLicenceFile) {
      setErrorMessage("Please provide at least one form of photo ID (passport or driving licence).");
      return;
    }
    if (!addressProofFile) {
      setErrorMessage("Please provide a proof of address document.");
      return;
    }
    if (form.personal_utr && !UTR_PATTERN.test(form.personal_utr)) {
      setErrorMessage("Personal UTR must be exactly 10 digits.");
      return;
    }
    if (form.is_limited_company && form.company_utr && !UTR_PATTERN.test(form.company_utr)) {
      setErrorMessage("Company UTR must be exactly 10 digits.");
      return;
    }
    if (form.ni_number && !NI_NUMBER_PATTERN.test(form.ni_number)) {
      setErrorMessage("That doesn't look like a valid National Insurance number (e.g. AB123456C).");
      return;
    }

    const fileError =
      validateFile(passportFile) ||
      validateFile(drivingLicenceFile) ||
      validateFile(addressProofFile) ||
      validateFile(taxReturnFile) ||
      validateFile(latestAccountsFile);
    if (fileError) {
      setErrorMessage(fileError);
      return;
    }

    setSubmitting(true);
    try {
      const submissionId = crypto.randomUUID();

      // Uploaded one at a time (not all at once) — avoids firing several simultaneous
      // requests at Supabase Storage, which was intermittently tripping up a random
      // one of them under concurrent load.
      const passportPath = await uploadFile(submissionId, passportFile, "passport");
      const drivingLicencePath = await uploadFile(submissionId, drivingLicenceFile, "driving-licence");
      const addressProofPath = await uploadFile(submissionId, addressProofFile, "address-proof");
      const taxReturnPath = await uploadFile(submissionId, taxReturnFile, "tax-return-and-accounts");
      const latestAccountsPath = await uploadFile(submissionId, latestAccountsFile, "latest-filed-accounts");

      const { error } = await supabase.from(SUBMISSIONS_TABLE).insert({
        id: submissionId,
        ...form,
        passport_file_path: passportPath,
        driving_licence_file_path: drivingLicencePath,
        address_proof_file_path: addressProofPath,
        tax_return_accounts_file_path: taxReturnPath,
        latest_filed_accounts_file_path: latestAccountsPath,
      });

      if (error) throw new Error(error.message);

      // Fire the notification email — don't let a notification failure block the
      // client from seeing the success screen, so this is deliberately non-blocking.
      supabase.functions
        .invoke("notify-new-submission", {
          body: {
            record: {
              id: submissionId,
              full_name: form.full_name,
              is_limited_company: form.is_limited_company,
              company_name: form.company_name,
              created_at: new Date().toISOString(),
            },
          },
        })
        .catch((err) => console.error("Notification email failed to send:", err));

      setSubmitted(true);
    } catch (err) {
      setErrorMessage(err.message || "Something went wrong submitting the form. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="page">
        <div className="card card--centered">
          <img src="/logo.jpg" alt="Abacus Accountants" className="firm-logo" />
          <h1>Thank you</h1>
          <p>Your information has been received. We'll be in touch if we need anything further.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <form className="card" onSubmit={handleSubmit}>
        <img src="/logo.jpg" alt="Abacus Accountants" className="firm-logo" />
        <h1>New Client Onboarding</h1>
        <p className="intro">
          Please complete the information below and upload the requested documents. This lets us
          set up your file and meet our obligations under the Money Laundering, Terrorist Financing
          and Transfer of Funds Regulations 2017.
        </p>

        <section>
          <h2>Personal &amp; Business Information</h2>

          <div className="field">
            <label className="field-label">Full Name *</label>
            <input
              type="text"
              value={form.full_name}
              onChange={(e) => update("full_name", e.target.value)}
              required
            />
          </div>

          <div className="field-row">
            <div className="field">
              <label className="field-label">Mobile Number</label>
              <input
                type="tel"
                value={form.mobile_number}
                onChange={(e) => update("mobile_number", e.target.value)}
              />
            </div>
            <div className="field">
              <label className="field-label">Email Address</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
              />
            </div>
          </div>

          <PostcodeLookup
            onSelect={(fields) => setForm((f) => ({ ...f, ...fields }))}
          />

          <div className="field">
            <label className="field-label">Address Line 1 *</label>
            <input
              type="text"
              value={form.address_line_1}
              onChange={(e) => update("address_line_1", e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label className="field-label">Address Line 2</label>
            <input
              type="text"
              value={form.address_line_2}
              onChange={(e) => update("address_line_2", e.target.value)}
            />
          </div>

          <div className="field-row">
            <div className="field">
              <label className="field-label">Town / City *</label>
              <input
                type="text"
                value={form.town_city}
                onChange={(e) => update("town_city", e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label className="field-label">County</label>
              <input
                type="text"
                value={form.county}
                onChange={(e) => update("county", e.target.value)}
              />
            </div>
            <div className="field">
              <label className="field-label">Postcode *</label>
              <input
                type="text"
                value={form.postcode}
                onChange={(e) => update("postcode", e.target.value.toUpperCase())}
                required
              />
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label className="field-label">Date Moved into this Address</label>
              <input
                type="date"
                value={form.date_moved}
                onChange={(e) => update("date_moved", e.target.value)}
              />
            </div>

            <div className="field">
              <label className="field-label">Property Status</label>
              <div className="radio-group">
                <label>
                  <input
                    type="radio"
                    name="property_status"
                    checked={form.property_status === "renting"}
                    onChange={() => update("property_status", "renting")}
                  />
                  Renting
                </label>
                <label>
                  <input
                    type="radio"
                    name="property_status"
                    checked={form.property_status === "owned"}
                    onChange={() => update("property_status", "owned")}
                  />
                  Owned
                </label>
              </div>
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label className="field-label">Date of Birth</label>
              <input
                type="date"
                value={form.date_of_birth}
                onChange={(e) => update("date_of_birth", e.target.value)}
              />
            </div>
            <div className="field">
              <label className="field-label">Nationality</label>
              <input
                type="text"
                value={form.nationality}
                onChange={(e) => update("nationality", e.target.value)}
              />
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label className="field-label">National Insurance Number</label>
              <p className="field-hint">Format: e.g. AB123456C.</p>
              <input
                type="text"
                value={form.ni_number}
                onChange={(e) => update("ni_number", e.target.value.toUpperCase())}
                onBlur={(e) => validateOnBlur("ni_number", e.target.value)}
              />
              {fieldErrors.ni_number && <p className="field-error">{fieldErrors.ni_number}</p>}
            </div>
            <div className="field">
              <label className="field-label">Personal UTR Number</label>
              <p className="field-hint">10 digits. You may not have this — leave blank if not applicable.</p>
              <input
                type="text"
                inputMode="numeric"
                maxLength={10}
                value={form.personal_utr}
                onChange={(e) => update("personal_utr", e.target.value.replace(/\D/g, ""))}
                onBlur={(e) => validateOnBlur("personal_utr", e.target.value)}
              />
              {fieldErrors.personal_utr && <p className="field-error">{fieldErrors.personal_utr}</p>}
            </div>
          </div>

          <div className="field">
            <label className="field-label">Brief Description of What You Do</label>
            <textarea
              value={form.business_description}
              onChange={(e) => update("business_description", e.target.value)}
              rows={3}
            />
          </div>
        </section>

        <section>
          <h2>Identity &amp; Address Documents</h2>
          <p className="field-hint">
            Required under the Money Laundering, Terrorist Financing and Transfer of Funds
            Regulations 2017. Please provide at least one photo ID and one proof of address.
          </p>

          <FileDrop
            label="Passport photo page"
            hint="Proof of identity"
            file={passportFile}
            onChange={setPassportFile}
          />
          <FileDrop
            label="Driving licence"
            hint="Proof of identity"
            file={drivingLicenceFile}
            onChange={setDrivingLicenceFile}
          />
          <FileDrop
            label="Current utility bill or personal bank statement"
            hint="Proof of address — dated within the last 3 months"
            file={addressProofFile}
            onChange={setAddressProofFile}
          />
          <FileDrop
            label="Copy of last Tax Return and Accounts"
            hint="If you have previously filed — optional if this is your first return"
            file={taxReturnFile}
            onChange={setTaxReturnFile}
          />

          <div className="field-row">
            <div className="field">
              <label className="field-label">Bank Account Name</label>
              <input
                type="text"
                value={form.bank_account_name}
                onChange={(e) => update("bank_account_name", e.target.value)}
              />
            </div>
            <div className="field">
              <label className="field-label">Sort Code</label>
              <input
                type="text"
                value={form.bank_sort_code}
                onChange={(e) => update("bank_sort_code", e.target.value)}
              />
            </div>
            <div className="field">
              <label className="field-label">Account Number</label>
              <input
                type="text"
                value={form.bank_account_number}
                onChange={(e) => update("bank_account_number", e.target.value)}
              />
            </div>
          </div>
        </section>

        <section>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={form.is_moving_accountant}
              onChange={(e) => update("is_moving_accountant", e.target.checked)}
            />
            I am moving from a previous accountant
          </label>

          {form.is_moving_accountant && (
            <div className="limited-company-fields">
              <p className="field-hint">
                We'll use these details to request professional clearance from your previous accountant.
              </p>
              <div className="field-row">
                <div className="field">
                  <label className="field-label">Previous Accountant's Name</label>
                  <input
                    type="text"
                    value={form.previous_accountant_name}
                    onChange={(e) => update("previous_accountant_name", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label className="field-label">Previous Accountant's Email</label>
                  <input
                    type="email"
                    value={form.previous_accountant_email}
                    onChange={(e) => update("previous_accountant_email", e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
        </section>

        <section>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={form.is_limited_company}
              onChange={(e) => update("is_limited_company", e.target.checked)}
            />
            I operate through a limited company
          </label>

          {form.is_limited_company && (
            <div className="limited-company-fields">
              <div className="field">
                <label className="field-label">Company Name &amp; Number</label>
                <input
                  type="text"
                  value={form.company_name}
                  onChange={(e) => update("company_name", e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Company number"
                  value={form.company_number}
                  onChange={(e) => update("company_number", e.target.value)}
                  style={{ marginTop: 8 }}
                />
              </div>
              <div className="field-row">
                <div className="field">
                  <label className="field-label">Company Authentication Code</label>
                  <input
                    type="text"
                    value={form.company_auth_code}
                    onChange={(e) => update("company_auth_code", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label className="field-label">Company UTR</label>
                  <p className="field-hint">10 digits</p>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={10}
                    value={form.company_utr}
                    onChange={(e) => update("company_utr", e.target.value.replace(/\D/g, ""))}
                    onBlur={(e) => validateOnBlur("company_utr", e.target.value)}
                  />
                  {fieldErrors.company_utr && <p className="field-error">{fieldErrors.company_utr}</p>}
                </div>
              </div>

              <FileDrop
                label="Copy of Latest Filed Accounts"
                file={latestAccountsFile}
                onChange={setLatestAccountsFile}
              />
            </div>
          )}
        </section>

        {errorMessage && <p className="field-error field-error--form">{errorMessage}</p>}

        <button type="submit" className="submit-button" disabled={submitting}>
          {submitting ? "Submitting…" : "Submit"}
        </button>
      </form>
    </div>
  );
}
