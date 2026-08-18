import { AppHeader } from "@/components/app-header";

export default function AppLayout({ children }: React.PropsWithChildren) {
  return (
    <>
      <AppHeader />
      {children}
    </>
  );
}