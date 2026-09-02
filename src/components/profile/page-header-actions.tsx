"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, FileText, Download } from "lucide-react";
import { toast } from "@/components/ui/sonner";

export function PageHeaderActions() {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <Button size="sm" onClick={() => toast.success("Edit Student — coming soon")}>
        <Pencil className="h-4 w-4" />
        Edit Student
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon" aria-label="More actions" />}
        >
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => toast.success("View Documents — open Documents tab")}>
            <FileText className="h-4 w-4" /> View Documents
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => toast.success("Download Transcript — coming soon")}>
            <Download className="h-4 w-4" /> Download Transcript
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
