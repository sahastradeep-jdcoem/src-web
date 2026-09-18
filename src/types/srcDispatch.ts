import { SrcFormField } from "@/types";

export type SrcDispatchCategory = "update" | "event" | "payment_qr" | "notice" | "form";
export type SrcDispatchPriority = "normal" | "important" | "urgent";
export type SrcDispatchTarget = "all_members" | "single_member";

export interface SrcDispatchEventDetails {
  eventName: string;
  date: string;
  time?: string;
  venue: string;
  actionUrl?: string; // Meeting link or RSVP form
  meetingType?: "in_person" | "online" | "hybrid";
  agenda?: string;
}

export interface SrcDispatchPaymentDetails {
  amount: number;
  purpose: string;
  upiId: string;
  payeeName: string;
  qrImageUrl?: string; // Uploaded custom QR code image
  deadline?: string;
  accountDetails?: string;
  note?: string;
}

export interface SrcDispatchResponseRecord {
  id: string;
  dispatchId: string;
  dispatchTitle?: string;
  userId?: string;
  userEmail?: string;
  userName?: string;
  userBtId?: string;
  btId?: string;
  userDepartment?: string;
  department?: string;
  userYear?: string;
  year?: string;
  userPhone?: string;
  phone?: string;
  submittedAt: string;
  updatedAt?: string;
  status?: "pending" | "approved" | "rejected" | "resolved" | "reviewed";
  adminFeedback?: string;
  adminNote?: string;
  answers: Record<string, any>;
}

export interface SrcDispatch {
  id: string;
  title: string;
  category: SrcDispatchCategory;
  priority: SrcDispatchPriority;
  targetType: SrcDispatchTarget;
  targetBtId?: string; // Specific College BT ID if targeted to a single member
  targetMemberName?: string;
  targetMemberRole?: string;
  content: string; // Detailed message, agenda, or instructions
  badgeText?: string;
  createdAt: string;
  eventDetails?: SrcDispatchEventDetails;
  paymentDetails?: SrcDispatchPaymentDetails;
  
  // SRC Forms Integration
  formFields?: SrcFormField[];
  formDeadline?: string;
  allowResponseEditing?: boolean;
  requiresApproval?: boolean;

  authorName: string;
  authorRole?: string;
  status: "active" | "archived";
}
