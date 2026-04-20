import { useEffect, useMemo, useState } from "react";

function SearchableSelect({
  label,
  placeholder,
  options,
  value,
  onChange,
  disabled = false,
  allowCustom = false,
}) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setSearch(value || "");
  }, [value]);

  const filteredOptions = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (
      !keyword ||
      (isOpen &&
        keyword ===
          String(value || "")
            .trim()
            .toLowerCase())
    ) {
      return options;
    }

    return options.filter((option) => option.toLowerCase().includes(keyword));
  }, [options, search, isOpen, value]);

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
      if (allowCustom) {
        const normalized = String(search || "").trim();
        if (normalized && normalized !== String(value || "")) {
          onChange(normalized);
        }
      }
      setIsOpen(false);
    }, 150);
  }

  function handleKeyDown(event) {
    if (!allowCustom) {
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const normalized = String(search || "").trim();
      if (normalized && normalized !== String(value || "")) {
        onChange(normalized);
      }
      setIsOpen(false);
    }
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
        onKeyDown={handleKeyDown}
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
