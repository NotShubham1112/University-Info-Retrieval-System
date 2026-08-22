"use client";

import dynamic from "next/dynamic";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
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

export function ProfileTabs({ student }: { student: StudentCore }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">
          {student.first_name} {student.last_name}
        </h1>
        <p className="text-sm text-muted-foreground">
          {student.pnr} · {student.roll_number ?? "—"}
          {student.course_id ? ` · Course #${student.course_id}` : ""}
          {student.current_semester ? ` · Sem ${student.current_semester}` : ""}
        </p>
        {(student.latest_sgpa != null || student.backlog_count != null) && (
          <p className="mt-1 text-xs text-muted-foreground">
            {student.latest_sgpa != null ? `Latest SGPA: ${Number(student.latest_sgpa).toFixed(2)}` : ""}
            {student.latest_sgpa != null && student.backlog_count != null ? " · " : ""}
            {student.backlog_count != null ? `Backlogs: ${student.backlog_count}` : ""}
            {student.latest_result_status ? ` · ${student.latest_result_status}` : ""}
          </p>
        )}
      </div>
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
