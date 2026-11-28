import type { BillInput } from "@/features/bills/schemas/billSchema";

export type ProposedBillDraft = Omit<BillInput, "reference_month"> & {
  reference_month?: string;
  category_name: string;
  recurring?: boolean;
};

export interface ChatMessageItem {
  id: string;
  role: "user" | "assistant";
  content: string;
  proposedBill?: ProposedBillDraft;
  proposalStatus?: "pending" | "saved" | "cancelled";
}
