import { useEffect, useMemo, useState } from "react";

function SearchableSelect({
  label,
  placeholder,
  options,
  value,
  onChange,
  disabled = false
}) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setSearch(value || "");
  }, [value]);

  const filteredOptions = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) {
      return options;
    }

    return options.filter((option) =>
      option.toLowerCase().includes(keyword)
    );
  }, [options, search]);

  function handleSelect(option) {
    onChange(option);
    setSearch(option);
    setIsOpen(false);
  }

  function handleFocus() {
    if (!disabled) {
      setIsOpen(true);
    }
  }

  function handleBlur() {
    setTimeout(() => {
      setIsOpen(false);
    }, 150);
  }

  return (
    <div className="searchable-select">
      <label>{label}</label>

      <input
        type="text"
        value={search}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChange={(event) => {
          setSearch(event.target.value);
          setIsOpen(true);
        }}
      />

      {isOpen && !disabled && (
        <div className="dropdown-list">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <button
                key={option}
                type="button"
                className="dropdown-item"
                onMouseDown={() => handleSelect(option)}
              >
                {option}
              </button>
            ))
          ) : (
            <div className="dropdown-empty">No matching results</div>
          )}
        </div>
      )}
    </div>
  );
}

export default SearchableSelect;