# Admin RBAC

## Authorization model

Authorization is based on the authenticated Firebase UID and a normalized BT ID. The BT ID is the human-auditable assignment key; the UID is the immutable enforcement key. Firestore is authoritative. `localStorage` may display cached profile data, but it never grants an admin scope.

| Role | Capabilities |
| --- | --- |
| Owner | Full admin access, role assignment/revocation, all clubs and tenures |
| Treasurer | Payments surface and payment review/configuration |
| Protocol Officer | SRC Operations surface |
| Club Owner | Assigned club, events/listings for that club, and associated registrations/payments |

The owner is a break-glass identity configured with `NEXT_PUBLIC_SRC_OWNER_EMAIL` and the existing primary owner fallback identities. The same primary identities are intentionally duplicated in `firestore.rules` because Firestore rules cannot read client environment variables. An explicit `OWNER` assignment can also be stored in Firestore.

## Firestore schema

`/admin_access/{uid}`

```ts
{
  uid: string,
  btId: string,
  role: "OWNER" | "TREASURER" | "PROTOCOL_OFFICER" | "CLUB_OWNER",
  clubId?: string,
  clubSlug?: string,
  clubName?: string,
  tenureId?: string,
  active: boolean,
  grantedBy: string,
  grantedAt: string,
  updatedAt: string
}
```

The document ID is the Firebase UID. The owner-only `/admin/roles` page derives candidates from the active club leadership, Treasurer, and protocol/operations rosters, then resolves the BT ID to a registered Firebase user before writing the assignment. Manual BT-ID correction and bulk tenure-start granting are supported.

## Enforcement

- `AuthContext` fetches and live-subscribes to `/admin_access/{uid}`.
- `admin/layout.tsx` gates every admin route; `AdminSidebar` only shows permitted navigation.
- Role-specific pages scope event, club, listing, registration, and payment data to the assigned club.
- `firestore.rules` protects `/admin_access`, event writes, role-sensitive site content, and registration/payment mutations. Existing legacy council admins remain supported for migration compatibility.
- Revoke is a Firestore write with an immediate live-listener update, so a revoked session loses scoped navigation on refresh/auth refresh.

## Operational rollout

1. Deploy the application and Firestore rules.
2. Set `NEXT_PUBLIC_SRC_OWNER_EMAIL` to the actual owner before production deployment and add the same email to `firestore.rules` if it is not already listed.
3. Sign in as owner, open **Admin → Roles**, verify the detected BT IDs, and click **Grant detected tenure access**.
4. Use manual assignment for missing or corrected BT IDs.
5. At each tenure start, review the detected roster and run the bulk grant, then revoke outgoing assignments.
