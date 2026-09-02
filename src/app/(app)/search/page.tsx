import { SearchBox } from "@/components/search-box";

export default function SearchPage() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">University Info Retrieval</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">Find a student</h1>
      <p className="mt-1 text-sm text-muted-foreground">Search by PNR, roll number, or name — results show a photo placeholder for every record.</p>
      <div className="mt-6">
        <SearchBox />
      </div>
    </main>
  );
}