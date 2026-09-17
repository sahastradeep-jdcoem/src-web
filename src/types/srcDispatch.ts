export type SrcDispatchCategory = "update" | "event" | "payment_qr" | "notice";
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
  authorName: string;
  authorRole?: string;
  status: "active" | "archived";
}
