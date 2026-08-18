import { SearchBox } from "@/components/search-box";

export default function SearchPage() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">Find a student</h1>
      <SearchBox />
    </main>
  );
}