import React from "react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col md:flex-row">
      <AdminSidebar />
      <div className="flex-1 min-w-0 p-4 sm:p-8 lg:p-10 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
