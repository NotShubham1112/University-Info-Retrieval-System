"use client";

import { Input } from "@/components/ui/input";
import { StudentResults } from "@/components/student-results";
import { useStudentSearch } from "@/lib/search/hooks";

export function SearchBox() {
  const search = useStudentSearch();
  return (
    <div className="flex flex-col gap-4">
      <Input
        type="search"
        placeholder="Search by PNR (22CS1045), roll number (1045), or name (Rahul)"
        value={search.q}
        onChange={(e) => search.onChange(e.target.value)}
        className="text-base"
      />
      <StudentResults {...search} />
    </div>
  );
}