"use client";

import dynamic from "next/dynamic";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

const AcademicTab = dynamic(
  () => import("@/components/profile/academic-tab").then((m) => m.AcademicTab),
  { loading: () => <Skeleton className="h-32 w-full" /> }
);
const AttendanceTab = dynamic(
  () => import("@/components/profile/attendance-tab").then((m) => m.AttendanceTab),
  { loading: () => <Skeleton className="h-32 w-full" /> }
);
const FeesTab = dynamic(
  () => import("@/components/profile/fees-tab").then((m) => m.FeesTab),
  { loading: () => <Skeleton className="h-32 w-full" /> }
);
const DocumentsTab = dynamic(
  () => import("@/components/profile/documents-tab").then((m) => m.DocumentsTab),
  { loading: () => <Skeleton className="h-32 w-full" /> }
);

export interface StudentCore {
  id: number;
  pnr: string;
  roll_number: string | null;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  email: string | null;
  phone: string | null;
  admission_date: string;
  status: string;
  program_id: number | null;
  campus_id: number | null;
  category_id?: number | null;
  abc_id?: string | null;
  gender?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  blood_group?: string | null;
  photo_path?: string | null;
  guardian_name?: string | null;
  guardian_contact_number?: string | null;
  admission_id?: number | null;
  course_id?: number | null;
  academic_year_id?: number | null;
  admission_mode?: string | null;
  seat_type?: string | null;
  intake_stream?: string | null;
  expected_grad_year?: number | null;
  admission_roll_number?: string | null;
  current_semester?: number | null;
  backlog_count?: number | null;
  latest_semester_no?: number | null;
  latest_sgpa?: number | string | null;
  latest_result_status?: string | null;
  latest_declared_at?: string | null;
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

function initialsOf(s: StudentCore) {
  return `${s.first_name?.[0] ?? ""}${s.last_name?.[0] ?? ""}`.toUpperCase();
}

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium leading-none">{value}</dd>
    </div>
  );
}

export function ProfileTabs({ student }: { student: StudentCore }) {
  const fullName = `${student.first_name} ${student.last_name}`;
  const isActive = student.status === "active";

  return (
    <div className="flex flex-col gap-6">
      {/* Profile Hero — modern Card rounded-xl tight */}
      <Card className="rounded-xl">
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-4">
              <Avatar className="h-12 w-12 sm:h-14 sm:w-14 shrink-0 rounded-full border">
                {student.photo_path ? <AvatarImage src={student.photo_path} alt={fullName} /> : null}
                <AvatarFallback className="text-sm font-semibold">{initialsOf(student) || "—"}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <h2 className="text-2xl font-semibold tracking-tight leading-none">{fullName}</h2>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  PNR {student.pnr} · Roll {student.roll_number ?? "—"}
                  {student.abc_id ? ` · ABC ${student.abc_id}` : ""}
                </p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="text-[11px] font-medium">
                    Course #{student.course_id ?? "—"}
                  </Badge>
                  <Badge variant="outline" className="text-[11px] font-medium">
                    Semester {student.current_semester ?? student.latest_semester_no ?? "—"}
                  </Badge>
                  {student.category_id ? (
                    <Badge variant="outline" className="text-[11px] font-medium">
                      Cat #{student.category_id}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[11px] font-medium uppercase">
                      EWS
                    </Badge>
                  )}
                  {student.seat_type ? (
                    <Badge variant="outline" className="text-[11px] font-medium uppercase">
                      {student.seat_type}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[11px] font-medium uppercase">
                      CAP
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="shrink-0 self-start">
              <Badge
                variant="outline"
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
              >
                <span
                  className={`h-2 w-2 rounded-full ${isActive ? "bg-emerald-500" : "bg-amber-500"}`}
                  aria-hidden
                />
                {isActive ? "Active" : student.status}
              </Badge>
            </div>
          </div>

          <Separator className="my-4" />
          <dl className="grid grid-cols-3 gap-4">
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">SGPA</dt>
              <dd className="mt-1 text-lg font-semibold leading-none tracking-tight">
                {student.latest_sgpa != null ? Number(student.latest_sgpa).toFixed(2) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Backlogs</dt>
              <dd className="mt-1 text-lg font-semibold leading-none tracking-tight">
                {student.backlog_count != null ? String(student.backlog_count) : "0"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Result</dt>
              <dd className="mt-1 text-sm font-semibold uppercase tracking-wider leading-none">
                {student.latest_result_status ?? "PASS"}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Profile Information Grid — 3 cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Personal Information</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <MetaField label="Date of Birth" value={student.date_of_birth ?? "—"} />
              <MetaField label="Gender" value={student.gender ?? "—"} />
              <MetaField label="Blood Group" value={student.blood_group ?? "—"} />
              <MetaField label="Category" value={student.category_id != null ? `Category #${student.category_id}` : "—"} />
            </dl>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Contact Information</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <MetaField
                label="Address"
                value={
                  student.address
                    ? `${student.address}${student.city ? `, ${student.city}` : ""}${student.state ? `, ${student.state}` : ""}${student.country ? `, ${student.country}` : ""}`
                    : "—"
                }
              />
              <MetaField label="Email" value={student.email ?? "—"} />
              <MetaField label="Phone" value={student.phone ?? "—"} />
            </dl>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Guardian Information</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <MetaField label="Guardian" value={student.guardian_name ?? "—"} />
              <MetaField label="Contact" value={student.guardian_contact_number ?? "—"} />
              <MetaField label="ABC ID" value={student.abc_id ?? "—"} />
            </dl>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="personal">
        <TabsList className="h-9 bg-muted p-1 rounded-lg">
          <TabsTrigger value="personal" className="rounded-md data-active:bg-background data-active:shadow-sm">
            Personal
          </TabsTrigger>
          <TabsTrigger value="admission" className="rounded-md data-active:bg-background data-active:shadow-sm">
            Admission
          </TabsTrigger>
          <TabsTrigger value="academic" className="rounded-md data-active:bg-background data-active:shadow-sm">
            Academic
          </TabsTrigger>
          <TabsTrigger value="attendance" className="rounded-md data-active:bg-background data-active:shadow-sm">
            Attendance
          </TabsTrigger>
          <TabsTrigger value="fees" className="rounded-md data-active:bg-background data-active:shadow-sm">
            Fees
          </TabsTrigger>
          <TabsTrigger value="documents" className="rounded-md data-active:bg-background data-active:shadow-sm">
            Documents
          </TabsTrigger>
        </TabsList>
        <TabsContent value="personal" className="mt-6">
          <Card>
            <CardContent>
              <dl>
                <Detail label="Date of birth" value={student.date_of_birth ?? "—"} />
                <Detail label="Email" value={student.email ?? "—"} />
                <Detail label="Phone" value={student.phone ?? "—"} />
                <Detail label="Gender" value={student.gender ?? "—"} />
                <Detail label="ABC ID" value={student.abc_id ?? "—"} />
                <Detail label="Blood group" value={student.blood_group ?? "—"} />
                <Detail
                  label="Address"
                  value={
                    student.address
                      ? `${student.address}${student.city ? `, ${student.city}` : ""}${student.state ? `, ${student.state}` : ""}${student.country ? `, ${student.country}` : ""}`
                      : "—"
                  }
                />
                <Detail
                  label="Guardian"
                  value={
                    student.guardian_name
                      ? `${student.guardian_name}${student.guardian_contact_number ? ` · ${student.guardian_contact_number}` : ""}`
                      : "—"
                  }
                />
                <Detail label="Photo" value={student.photo_path ?? "—"} />
              </dl>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="admission" className="mt-6">
          <Card>
            <CardContent>
              <dl>
                <Detail label="Admission date" value={student.admission_date} />
                <Detail label="Status" value={student.status} />
                <Detail label="Program ID" value={String(student.program_id ?? "—")} />
                <Detail label="Campus ID" value={String(student.campus_id ?? "—")} />
                <Detail label="Course ID" value={String(student.course_id ?? "—")} />
                <Detail label="Category ID" value={String(student.category_id ?? "—")} />
                <Detail label="Admission mode" value={student.admission_mode ?? "—"} />
                <Detail label="Seat type" value={student.seat_type ?? "—"} />
                <Detail label="Intake stream" value={student.intake_stream ?? "—"} />
                <Detail label="Expected grad" value={student.expected_grad_year ? String(student.expected_grad_year) : "—"} />
                <Detail label="Admission roll" value={student.admission_roll_number ?? student.roll_number ?? "—"} />
                <Detail label="Current semester" value={student.current_semester ? String(student.current_semester) : "—"} />
                <Detail label="Backlog count" value={student.backlog_count != null ? String(student.backlog_count) : "—"} />
                <Detail label="Latest SGPA" value={student.latest_sgpa != null ? String(student.latest_sgpa) : "—"} />
              </dl>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="academic" className="mt-6">
          <AcademicTab studentId={student.id} />
        </TabsContent>
        <TabsContent value="attendance" className="mt-6">
          <AttendanceTab studentId={student.id} />
        </TabsContent>
        <TabsContent value="fees" className="mt-6">
          <FeesTab studentId={student.id} />
        </TabsContent>
        <TabsContent value="documents" className="mt-6">
          <DocumentsTab studentId={student.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
