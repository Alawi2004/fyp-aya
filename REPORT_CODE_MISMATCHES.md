# Report vs. Code — Corrections Needed

This file lists spots in the FYP report where the text is out of sync with the current
codebase, along with ready-to-paste replacement text. Original quotes are from the
report; replacements reflect what the code actually does as of 2026-06-08.

## 1. Table 5 — Business Logic / API Layer row

**Original:**
> RESTful API Gateway, Authentication Service, GPS Service, Driver Trip Service,
> Notification Service, Passenger Count Service | Node.js / Express.js — **17 route
> modules**, JWT-based role authentication (passenger / driver / admin)

**Replace "17 route modules" with:**
> **32 route modules**

(`backend/src/routes/` currently contains 32 `.routes.js` files.)

## 2. Table 5 — Data Layer row

**Original:**
> Relational database: **12 core tables plus wallets, wallet_transactions, and issues
> tables added during development**. Views and stored procedures encapsulate critical
> queries.

**Replace with:**
> Relational database: **56 tables** spanning core operations (users, drivers,
> vehicles, routes, stops, trips, tickets, ratings, notifications), wallet & staff-shift
> management (wallets, wallet_transactions, wallet_recharges, staff_shift_sessions,
> staff_reconciliation), passenger-camera analytics (camera_passenger_events,
> camera_driver_alerts, camera_health_log), complaint handling (complaints,
> complaint_updates), and security/audit logging (audit_logs, login_audit_logs,
> refresh_tokens). Views and stored procedures encapsulate critical queries.

> Note: there is no `issues` table — the equivalent is `complaints` / `complaint_updates`.

## 3. Table 3 — `notifications` entity row

**Original:**
> notifications | System messages per user (pull-based) | is_read BIT DEFAULT 0;
> **no push mechanism**

**Replace with:**
> notifications | System messages per user, delivered via in-app pull and push |
> is_read BIT DEFAULT 0; **integrated with Firebase Cloud Messaging and Expo push
> notifications (`fcm.service.js`); sent_count/read_count columns track delivery and
> engagement**

## 4. Table 3 — `eta_predictions` entity row

**Original:**
> eta_predictions | ETA records per trip | Schema defined; **prediction engine planned
> for future work**

**Replace with:**
> eta_predictions | ETA records per trip | **Populated by an implemented ML pipeline
> (`/api/ml` routes) providing delay prediction, demand forecasting, and
> admin-triggered model retraining**

## 5. Abstract / Objective 5 / Conclusion — "future AI integration" framing

Wherever the report frames AI/ML as *future work* — e.g. the abstract ("lays a solid...
foundation for future enhancements, including the integration of artificial
intelligence for predictive analytics, demand forecasting, and dynamic scheduling") and
Objective 5 ("Create an AI-Ready Architecture... to incorporate advanced AI/ML models
for predictive ETA, demand forecasting") — this should be reframed. The system
**already implements** delay prediction and demand forecasting: `ml.routes.js` exposes
`/delay-prediction`, `/demand-forecast`, `/demand-forecast/day`, plus admin retraining
endpoints `/train`, `/train-demand`, `/train-all`.

**Suggested rewording for Objective 5:**
> 5. Deliver AI-Powered Predictive Features: To implement and integrate machine-learning
> models for delay prediction and demand forecasting directly into the platform (with
> admin-triggered retraining), and to design the architecture so these models can be
> extended to dynamic scheduling and route optimization in future iterations.

**Suggested rewording for the abstract/conclusion:**
> ...the platform already incorporates machine-learning-based delay prediction and
> demand forecasting, with a foundation for extending these into dynamic scheduling and
> route optimization.

---

## Open item

Chapters V (Development & Implementation) and VI (Experiments & Results) are still
placeholders in the outline — once filled in, they should be re-checked against the
code (e.g. actual test coverage, hardware/camera integration details) the same way.