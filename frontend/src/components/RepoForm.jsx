import SearchableSelect from "./SearchableSelect";

function RepoForm({
  owner,
  repo,
  ownerOptions,
  repoOptions,
  onOwnerChange,
  onRepoChange,
  onSubmit
}) {
  return (
    <form className="repo-form" onSubmit={onSubmit}>
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

      <button type="submit">Load Dashboard</button>
    </form>
  );
}

export default RepoForm;
