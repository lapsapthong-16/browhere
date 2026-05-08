import { Button, Input, Label } from "@fluentui/react-components";
import { useEffect, useRef } from "react";

export function App() {
  const queryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    queryInputRef.current?.focus();
  }, []);

  return (
    <main className="app-shell" aria-labelledby="app-title">
      <section className="search-surface">
        <p className="app-kicker">Desktop Search</p>
        <h1 id="app-title">Search your files</h1>
        <form className="search-form" role="search" aria-label="File search">
          <Label htmlFor="file-query">Describe the file you remember</Label>
          <div className="search-row">
            <Input
              ref={queryInputRef}
              id="file-query"
              name="query"
              type="search"
              autoComplete="off"
              placeholder="Quarterly budget spreadsheet from March"
              aria-describedby="search-hint"
            />
            <Button appearance="primary" type="submit">
              Search
            </Button>
          </div>
          <p id="search-hint">
            Start with a natural language memory of the file. Results will
            appear in this window.
          </p>
        </form>
      </section>
    </main>
  );
}
