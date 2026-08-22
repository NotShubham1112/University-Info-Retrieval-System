"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Search, Bell, LogOut, User, FileText, GraduationCap } from "lucide-react";

const NAV_ITEMS = [
  { label: "Students", href: "/search" },
  { label: "Academics", href: "/search" },
  { label: "Attendance", href: "/search" },
  { label: "Fees", href: "/search" },
  { label: "Documents", href: "/search" },
] as const;

export function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function handleSignOut() {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initials = email ? email.slice(0, 2).toUpperCase() : "U";

  return (
    <>
      <header className="sticky top-0 z-40 h-14 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          {/* Left: logo */}
          <div className="flex items-center gap-8">
            <Link href="/search" className="text-sm font-semibold tracking-tight">
              University Info
            </Link>
            {/* Center/left nav — hidden on mobile */}
            <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
              {NAV_ITEMS.map((item) => {
                const active = pathname?.startsWith(item.href) && item.label === "Students";
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors duration-150 hover:bg-muted hover:text-foreground ${
                      active ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Search"
              onClick={() => setOpen(true)}
              className="text-muted-foreground hover:text-foreground"
            >
              <Search className="h-4 w-4" />
            </Button>
            {/* hint for desktop */}
            <span className="hidden lg:inline-flex items-center gap-1 rounded-md border bg-muted px-1.5 py-1 text-[11px] font-medium text-muted-foreground">
              ⌘K
            </span>
            <Button variant="ghost" size="icon" aria-label="Notifications" className="text-muted-foreground hover:text-foreground">
              <Bell className="h-4 w-4" />
            </Button>
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger className="ml-1 rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs font-medium">{initials}</AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <p className="text-sm font-medium leading-none">Signed in as</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{email ?? "—"}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push("/search")}>
                  <User className="mr-2 h-4 w-4" /> Profile
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <CommandDialog open={open} onOpenChange={setOpen} title="Search" description="Search students and records">
        <CommandInput placeholder="Search students, PNR, courses…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Quick actions">
            <CommandItem onSelect={() => { setOpen(false); router.push("/search"); }}>
              <GraduationCap className="h-4 w-4" /> Go to Students
            </CommandItem>
            <CommandItem onSelect={() => { setOpen(false); router.push("/search"); }}>
              <FileText className="h-4 w-4" /> View Documents
            </CommandItem>
            <CommandItem onSelect={() => { setOpen(false); router.push("/search"); }}>
              <Search className="h-4 w-4" /> Advanced search
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
