import SearchableSelect from "./SearchableSelect";

function RepoForm({
  owner,
  repo,
  ownerOptions,
  repoOptions,
  onOwnerChange,
  onRepoChange,
  onSubmit,
}) {
  return (
    <form className="repo-form" onSubmit={onSubmit}>
      <div className="section-heading repo-form-heading">
        <div>
          <h2>Choose what to inspect</h2>
          <p className="section-description">
            Pick an owner and repository to refresh the overview,
            vulnerabilities, and history.
          </p>
        </div>
      </div>

      <SearchableSelect
        label="Owner"
        placeholder="Search and select owner"
        options={ownerOptions}
        value={owner}
        onChange={onOwnerChange}
      />

      <SearchableSelect
        label="Repository"
        placeholder="Search and select repository"
        options={repoOptions}
        value={repo}
        onChange={onRepoChange}
        disabled={!owner}
      />

      <div className="repo-form-actions">
        <button type="submit">Load dashboard</button>
      </div>
    </form>
  );
}

export default RepoForm;
