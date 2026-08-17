import { useState } from "react";

const IDEAL_POSTCODES_API_KEY = import.meta.env.VITE_IDEAL_POSTCODES_API_KEY;

// Ideal Postcodes (https://ideal-postcodes.co.uk) — Royal Mail PAF-licensed UK postcode
// lookup. A credit is only spent when a postcode is found and addresses are returned;
// an invalid/not-found postcode costs nothing (see their docs on "Postcode Not Found").
async function lookupPostcode(postcode) {
  const cleaned = postcode.trim();
  const url = `https://api.ideal-postcodes.co.uk/v1/postcodes/${encodeURIComponent(
    cleaned
  )}?api_key=${encodeURIComponent(IDEAL_POSTCODES_API_KEY)}`;

  const response = await fetch(url);

  if (response.status === 404) {
    return { notFound: true, results: [] };
  }
  if (!response.ok) {
    throw new Error(`Postcode lookup failed (${response.status})`);
  }

  const data = await response.json();
  return { notFound: false, results: data.result || [] };
}

// Builds a readable one-line summary for a given result from the API.
function summariseAddress(result) {
  const parts = [
    result.line_1,
    result.line_2,
    result.line_3,
  ].filter(Boolean);
  return parts.join(", ");
}

export default function PostcodeLookup({ onSelect }) {
  const [postcodeInput, setPostcodeInput] = useState("");
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | loading | found | not-found | error
  const [errorMessage, setErrorMessage] = useState("");

  async function handleFind() {
    if (!postcodeInput.trim()) return;
    setStatus("loading");
    setErrorMessage("");
    setResults([]);
    try {
      const { notFound, results } = await lookupPostcode(postcodeInput);
      if (notFound || results.length === 0) {
        setStatus("not-found");
        return;
      }
      setResults(results);
      setStatus("found");
    } catch (err) {
      setStatus("error");
      setErrorMessage(
        "Address lookup isn't available right now — please enter your address manually below."
      );
    }
  }

  function handleSelect(e) {
    const index = e.target.value;
    if (index === "") return;
    const result = results[index];
    onSelect({
      address_line_1: result.line_1 || "",
      address_line_2: [result.line_2, result.line_3].filter(Boolean).join(", "),
      town_city: result.post_town || "",
      county: result.county || "",
      postcode: result.postcode || postcodeInput.trim(),
    });
  }

  if (!IDEAL_POSTCODES_API_KEY) {
    // No key configured — silently skip lookup, manual fields below still work.
    return null;
  }

  return (
    <div className="field postcode-lookup">
      <label className="field-label">Find Address by Postcode</label>
      <div className="postcode-lookup__row">
        <input
          type="text"
          value={postcodeInput}
          onChange={(e) => setPostcodeInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleFind();
            }
          }}
          placeholder="e.g. SW1A 2AA"
        />
        <button type="button" onClick={handleFind} disabled={status === "loading"}>
          {status === "loading" ? "Searching…" : "Find address"}
        </button>
      </div>

      {status === "found" && (
        <select className="postcode-lookup__results" defaultValue="" onChange={handleSelect}>
          <option value="" disabled>
            {results.length} address{results.length === 1 ? "" : "es"} found — select yours
          </option>
          {results.map((result, index) => (
            <option key={index} value={index}>
              {summariseAddress(result)}
            </option>
          ))}
        </select>
      )}

      {status === "not-found" && (
        <p className="field-hint">
          No addresses found for that postcode — please enter your address manually below.
        </p>
      )}

      {status === "error" && <p className="field-error">{errorMessage}</p>}

      <p className="field-hint">Or enter your address manually below.</p>
    </div>
  );
}
