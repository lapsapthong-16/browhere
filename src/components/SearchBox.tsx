import { Button, Input, Label } from "@fluentui/react-components";
import type { ChangeEvent, FormEvent, KeyboardEvent, Ref } from "react";

interface SearchBoxProps {
  inputRef: Ref<HTMLInputElement>;
  query: string;
  disabled?: boolean;
  onQueryChange: (query: string) => void;
  onSubmit: () => void;
}

export function SearchBox({
  inputRef,
  query,
  disabled = false,
  onQueryChange,
  onSubmit,
}: SearchBoxProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onSubmit();
    }
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onQueryChange(event.target.value);
  };

  return (
    <form
      className="search-form"
      role="search"
      aria-label="File search"
      onSubmit={handleSubmit}
    >
      <Label htmlFor="file-query">Describe the file you remember</Label>
      <div className="search-row">
        <Input
          ref={inputRef}
          id="file-query"
          name="query"
          type="search"
          value={query}
          autoComplete="off"
          placeholder="Quarterly budget spreadsheet from March"
          aria-describedby="search-hint search-feedback"
          onChange={handleChange}
          onKeyDown={handleKeyDown}
        />
        <Button
          appearance="primary"
          type="button"
          disabled={disabled}
          onClick={onSubmit}
        >
          Search
        </Button>
      </div>
      <p id="search-hint">
        Type a natural language memory of a file. Results stay in this window.
      </p>
    </form>
  );
}
