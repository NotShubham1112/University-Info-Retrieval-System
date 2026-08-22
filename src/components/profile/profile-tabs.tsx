"use client";

import dynamic from "next/dynamic";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

// Heavy profile tabs — dynamically imported with skeleton fallback to split bundle.
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
  // v4 — student_summary extensions (nullable when not yet fetched)
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
  // admissions (via student_summary left join)
  admission_id?: number | null;
  course_id?: number | null;
  academic_year_id?: number | null;
  admission_mode?: string | null;
  seat_type?: string | null;
  intake_stream?: string | null;
  expected_grad_year?: number | null;
  admission_roll_number?: string | null;
  // academic_progress
  current_semester?: number | null;
  backlog_count?: number | null;
  // latest semester_records
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

export function ProfileTabs({ student }: { student: StudentCore }) {
  return (
    <div className="flex flex-col gap-6">
      {/* CBI-style dossier header — photo left-top, name + file details right */}
      <Card className="overflow-hidden border-2">
        <div className="bg-muted/30 px-4 py-2 flex items-center justify-between border-b">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            University Record — Person Dossier &nbsp;·&nbsp; File No: {student.pnr}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground hidden sm:inline">Classification</span>
            <Badge variant={student.status === "active" ? "secondary" : "outline"} className="uppercase text-[10px]">
              {student.status}
            </Badge>
          </div>
        </div>
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row gap-5">
            {/* Photo — left top corner rectangle */}
            <div className="shrink-0">
              <div className="h-[168px] w-[132px] overflow-hidden rounded-md border-2 bg-muted shadow-sm">
                {student.photo_path ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={student.photo_path} alt={`${student.first_name} ${student.last_name}`} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-muted p-3 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full border bg-background text-sm font-semibold tracking-tight">
                      {initialsOf(student) || "—"}
                    </div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Photo Not Held</p>
                    <p className="text-[10px] leading-none text-muted-foreground">3.5 × 4.5 cm</p>
                  </div>
                )}
              </div>
              <p className="mt-1.5 text-center text-[10px] uppercase tracking-wider text-muted-foreground">ID Photo · {student.pnr}</p>
            </div>

            {/* Name + dossier fields */}
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-semibold tracking-tight leading-none">
                {student.first_name} {student.last_name}
              </h1>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                PNR {student.pnr} &nbsp;·&nbsp; Roll {student.roll_number ?? "—"}
                {student.abc_id ? ` · ABC ${student.abc_id}` : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge variant="outline" className="font-mono text-[11px]">Course #{student.course_id ?? "—"}</Badge>
                {student.current_semester ? <Badge variant="outline" className="text-[11px]">Sem {student.current_semester}</Badge> : null}
                {student.seat_type ? <Badge variant="outline" className="text-[11px] uppercase">{student.seat_type}</Badge> : null}
                {student.admission_mode ? <Badge variant="outline" className="text-[11px] uppercase">{student.admission_mode}</Badge> : null}
                {student.intake_stream ? <Badge variant="outline" className="text-[11px] uppercase">{student.intake_stream}</Badge> : null}
              </div>
              {(student.latest_sgpa != null || student.backlog_count != null || student.latest_result_status) && (
                <p className="mt-3 text-xs text-muted-foreground">
                  {student.latest_sgpa != null ? <><span className="font-medium text-foreground">SGPA {Number(student.latest_sgpa).toFixed(2)}</span> &nbsp;·&nbsp; </> : null}
                  {student.backlog_count != null ? <>Backlogs <span className="font-medium text-foreground">{student.backlog_count}</span> &nbsp;·&nbsp; </> : null}
                  {student.latest_result_status ? <span className="uppercase tracking-wider">{student.latest_result_status}</span> : null}
                  {student.latest_declared_at ? <span className="ml-1" suppressHydrationWarning>({new Date(student.latest_declared_at).toLocaleDateString("en-GB")})</span> : null}
                </p>
              )}
              <Separator className="my-3" />
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div><dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Date of Birth</dt><dd className="font-medium">{student.date_of_birth ?? "—"}</dd></div>
                <div><dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Gender</dt><dd className="font-medium">{student.gender ?? "—"}</dd></div>
                <div><dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Blood Group</dt><dd className="font-medium">{student.blood_group ?? "—"}</dd></div>
                <div><dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Category</dt><dd className="font-medium">{student.category_id != null ? `#${student.category_id}` : "—"}</dd></div>
                <div className="col-span-2"><dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Address</dt><dd className="font-medium leading-snug">{student.address ? `${student.address}${student.city ? `, ${student.city}` : ""}${student.state ? `, ${student.state}` : ""}${student.country ? `, ${student.country}` : ""}` : "—"}</dd></div>
                <div><dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Email</dt><dd className="font-medium truncate">{student.email ?? "—"}</dd></div>
                <div><dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Phone</dt><dd className="font-medium">{student.phone ?? "—"}</dd></div>
                <div className="col-span-2"><dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Guardian</dt><dd className="font-medium">{student.guardian_name ? `${student.guardian_name}${student.guardian_contact_number ? ` · ${student.guardian_contact_number}` : ""}` : "—"}</dd></div>
              </dl>
            </div>
          </div>
        </CardContent>
      </Card>
      <Tabs defaultValue="personal">
        <TabsList className="flex-wrap">
          <TabsTrigger value="personal">Personal</TabsTrigger>
          <TabsTrigger value="admission">Admission</TabsTrigger>
          <TabsTrigger value="academic">Academic</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="fees">Fees</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>
        <TabsContent value="personal">
          <Card>
            <CardContent>
              <dl>
                <Detail label="Date of birth" value={student.date_of_birth ?? "—"} />
                <Detail label="Email" value={student.email ?? "—"} />
                <Detail label="Phone" value={student.phone ?? "—"} />
                <Detail label="Gender" value={student.gender ?? "—"} />
                <Detail label="ABC ID" value={student.abc_id ?? "—"} />
                <Detail label="Blood group" value={student.blood_group ?? "—"} />
                <Detail label="Address" value={student.address ? `${student.address}${student.city ? `, ${student.city}` : ""}${student.state ? `, ${student.state}` : ""}${student.country ? `, ${student.country}` : ""}` : "—"} />
                <Detail label="Guardian" value={student.guardian_name ? `${student.guardian_name}${student.guardian_contact_number ? ` · ${student.guardian_contact_number}` : ""}` : "—"} />
                <Detail label="Photo" value={student.photo_path ?? "—"} />
              </dl>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="admission">
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
        <TabsContent value="academic">
          <AcademicTab studentId={student.id} />
        </TabsContent>
        <TabsContent value="attendance">
          <AttendanceTab studentId={student.id} />
        </TabsContent>
        <TabsContent value="fees">
          <FeesTab studentId={student.id} />
        </TabsContent>
        <TabsContent value="documents">
          <DocumentsTab studentId={student.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
