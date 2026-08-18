"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { AcademicTab } from "@/components/profile/academic-tab";
import { AttendanceTab } from "@/components/profile/attendance-tab";
import { FeesTab } from "@/components/profile/fees-tab";
import { DocumentsTab } from "@/components/profile/documents-tab";

export interface StudentCore {
  id: number;
  pnr: string;
  roll_number: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  email: string | null;
  phone: string | null;
  admission_date: string;
  status: string;
  program_id: number;
  campus_id: number;
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
          {student.pnr} · {student.roll_number}
        </p>
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
                <Detail
                  label="Date of birth"
                  value={student.date_of_birth ?? "—"}
                />
                <Detail label="Email" value={student.email ?? "—"} />
                <Detail label="Phone" value={student.phone ?? "—"} />
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
                <Detail label="Program ID" value={String(student.program_id)} />
                <Detail label="Campus ID" value={String(student.campus_id)} />
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