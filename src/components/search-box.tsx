"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { StudentResults } from "@/components/student-results";
import { useStudentSearch } from "@/lib/search/hooks";

export function SearchBox() {
  const search = useStudentSearch();
  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search by PNR (22CS1045), roll number (1045), or name (Rahul)"
          value={search.q}
          onChange={(e) => search.onChange(e.target.value)}
          className="pl-9 text-base"
        />
      </div>
      <StudentResults {...search} />
    </div>
  );
}