/** Pick an existing company, or type a new company name (which wins if filled in). */
export function CompanyPicker({
  companies,
  value,
}: {
  companies: { id: string; name: string }[];
  value?: string | null;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <label className="label" htmlFor="companyId">Company</label>
        <select className="input" id="companyId" name="companyId" defaultValue={value ?? ""}>
          <option value="">None</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="newCompany">…or add a new company</label>
        <input className="input" id="newCompany" name="newCompany" placeholder="Company name" />
      </div>
    </div>
  );
}
