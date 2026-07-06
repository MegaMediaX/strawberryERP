"use client";

import { useRouter } from "next/navigation";

import { NewLeadForm } from "@/components/platform/NewLeadForm";

export function SalesNewLead({
  assignedUser,
  assignees,
}: {
  assignedUser: string;
  assignees: readonly { name: string }[];
}) {
  const router = useRouter();
  return (
    <div className="grid gap-4">
      <h1 className="text-xl font-bold tracking-tight">Add lead</h1>
      <NewLeadForm
        defaultAssignedUser={assignedUser}
        assignees={assignees}
        onCreated={() => router.push("/sales/leads")}
      />
    </div>
  );
}
