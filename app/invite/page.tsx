// app/invite/page.tsx
import { Suspense } from "react";
import InviteClient from "./InviteClient";

export default function InvitePage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading...</div>}>
      <InviteClient />
    </Suspense>
  );
}
