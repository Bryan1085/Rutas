# Security Specification — RUTEO Shared Fleet Firestore Rules

## 1. Data Invariants
1. **Active Driver Roster Gate**: All writes to `/deliveries/{deliveryId}` and `/routes/{routeId}` require that the acting `assignedDriverId` or `ownerId` corresponds to an existing active driver document in `/drivers/{driverId}`. Deleting a driver immediately invalidates further writes from that driver ID.
2. **Schema & Bounds Enforcement**: Every write is validated by `isValidDeliveryItem`, `isValidDriverProfile`, or `isValidRouteSession` enforcing required keys, allowlisted keys (`hasOnly`), string `.size()` limits synchronized with `firebase-blueprint.json`, coordinate bounds, and valid status/coverage enums.
3. **Immutability & Temporal Integrity**: Document `id` and `createdAt` are immutable after creation. Server timestamps (`request.time`) are enforced for `createdAt` and `updatedAt` on `/deliveries` and `/drivers`.
4. **Action-Based Updates**: Updates to `/deliveries`, `/drivers`, and `/routes` are partitioned into explicit allowed key-change sets via `affectedKeys().hasOnly(...)`.
5. **No Google Auth Trade-off**: Per explicit user requirement, drivers identify solely by driver name on first launch without Google Sign-In and share full operational access to deliveries and routes.
6. **Bounded List Queries**: All collection list queries enforce explicit `request.query.limit` caps (`<= 100` for `/drivers` with `active == true`, `<= 500` for `/deliveries`, `<= 200` for `/routes`) matching the client SDK queries so static query evaluation succeeds without unbounded scans.

## 2. Adversarial Payloads ("Dirty Dozen" Red Team Matrix)
All 12 payloads below MUST evaluate to `PERMISSION_DENIED`:
1. **Unregistered driver write on `/deliveries/{id}`**: `assignedDriverId: "non-existent-driver"` -> Denied by `isActiveDriver(incoming().assignedDriverId)`.
2. **Deleted driver write on `/deliveries/{id}`**: Driver removed from `/drivers` attempts create/update -> Denied by `exists(/databases/.../drivers/$(driverId))`.
3. **Unregistered driver write on `/routes/{id}`**: `ownerId: "ghost"` -> Denied by `isActiveDriver(incoming().ownerId)`.
4. **Shadow Field Injection ("Ghost Field") on `/deliveries`**: Extra `{ isAdmin: true }` -> Denied by `data.keys().hasOnly(...)`.
5. **Shadow Field Injection on `/drivers`**: Extra `{ role: "superadmin" }` -> Denied by `isValidDriverProfile()`.
6. **ID Poisoning**: Document ID `"bad/id$123"` or >128 chars -> Denied by `isValidId(...)`.
7. **Value Poisoning (oversized address / failureReason / photo)**: `address.size() == 501` or `deliveryPhoto.size() == 600001` -> Denied by `isValidDeliveryItem()`.
8. **Oversized driver name**: `driverName.size() == 101` or empty `""` -> Denied by `isValidDriverProfile()`.
9. **Client Timestamp Forgery**: Creating/updating delivery or driver with fake timestamp for `createdAt`/`updatedAt` -> Denied by `== request.time`.
10. **Immutable ID / createdAt tampering on update**: Changing `id` or `createdAt` on `/deliveries` or `/routes` -> Denied by `incoming().id == existing().id` and `incoming().createdAt == existing().createdAt`.
11. **Invalid enum injection**: `status: "hacked"` or `coverageStatus: "fake"` -> Denied by enum allowlist checks.
12. **Unbounded route items array**: `items.size() == 201` -> Denied by `data.items.size() <= 200`.
