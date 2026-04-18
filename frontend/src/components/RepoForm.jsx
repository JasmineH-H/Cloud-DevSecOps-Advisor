import SearchableSelect from "./SearchableSelect";

function RepoForm({
  owner,
  repo,
  targetUrl,
  ownerOptions,
  repoOptions,
  onOwnerChange,
  onRepoChange,
  onTargetUrlChange,
  onSubmit,
}) {
  return (
    <form className="repo-form" onSubmit={onSubmit}>
      <div className="section-heading repo-form-heading">
        <div>
          <h2>Add project</h2>
          <p className="section-description">
            Pick an owner, repository, and target URL to load the dashboard for
            a project.
          </p>
        </div>
      </div>

      <div className="repo-form-grid">
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

        <div className="form-group repo-form-target">
          <label>Target URL</label>
          <input
            type="text"
            value={targetUrl}
            placeholder="https://example.com"
            onChange={(event) => onTargetUrlChange(event.target.value)}
          />
          <p className="form-help-text">
            This URL is used for pentest controls.
          </p>
        </div>

        <div className="repo-form-actions repo-form-primary-action">
          <button type="submit">Load dashboard</button>
        </div>
      </div>
    </form>
  );
}

export default RepoForm;
