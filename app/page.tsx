"use client";

import React from "react";
import { IndexPanel } from "@/app/components/IndexPanel";
import { SearchPanel } from "@/app/components/SearchPanel";
import { useBrowhereController } from "@/app/useBrowhereController";

export default function HomePage() {
  const controller = useBrowhereController();

  return (
    <main className="shell">
      <SearchPanel controller={controller} />
      <IndexPanel controller={controller} />
    </main>
  );
}

