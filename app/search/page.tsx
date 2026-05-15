"use client";

import React from "react";
import { SearchPanel } from "@/app/components/SearchPanel";
import { useBrowhereController } from "@/app/useBrowhereController";

export default function CompactSearchPage() {
  const controller = useBrowhereController();

  return (
    <main className="shell compactShell">
      <SearchPanel controller={controller} compact />
    </main>
  );
}

