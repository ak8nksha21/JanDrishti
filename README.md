# JanDrishti

JanDrishti is an AI-powered MPLADS (Member of Parliament Local Area Development Scheme) monitoring platform that analyzes MPLADS work allocations, execution timelines, and financial expenditure data to identify unusual patterns, potential duplicate/similar works, data-quality issues, and composite risk levels.

> **Important Note on Risk Assessment:** JanDrishti provides data-driven risk indicators and investigation support. Anomaly flags and risk scores indicate statistical outliers and data discrepancies for human review; they do **not** claim that an anomaly constitutes fraud.
>
> *Note on Scope:* ML anomaly detection, duplicate detection, risk scoring calculations, and agentic AI are separate upcoming modules. This stage provides the validated, normalized **Data Foundation**.

---

## 1. High-Level Architecture & Ingestion Flow

```
[ Real MPLADS Sources ]
  ├── Source A: Empowered Indian APIs (Itemized Completed Works & MP Financial Summaries)
  └── Source B: MoSPI eSAKSHI Portal (Public REST Endpoints for Macro Dashboard Tiles & State Metadata)
               │
               ▼
[ Source Adapters (app/services/ingestion/sources/) ]
  ├── empowered_indian.py  --> Pagination, Retries, Raw JSON Archival (data/raw/)
  └── mospi_esakshi.py     --> Public Dashboard Endpoints & Raw JSON Archival (data/raw/)
               │
               ▼
[ Normalization & PII Sanitization (app/services/ingestion/validation.py) ]
  ├── Strips/Redacts Incidental Phone Numbers & Emails
  ├── Safely Parses Datetimes, Numeric Amounts & Nulls (No Fake Defaults)
               │
               ▼
[ Ingestion Service (app/services/ingestion/service.py) ]
  └── Idempotent PostgreSQL Upsert (No Duplicate Records on Repeat Ingestion)
               │
               ▼
[ PostgreSQL 16 Database ]
  ├── works (Itemized completed works)
  ├── mp_financial_summaries (MP financial, recommended & completed works metrics)
  └── macro_metrics (National MoSPI macro indicators)
               │
               ▼
[ FastAPI REST API Layer (app/routes/) ]
  ├── GET /health & GET /
  ├── GET /api/works & GET /api/works/{work_id}
  ├── GET /api/mps
  └── GET /api/dashboard (Real SQL Aggregations)
```

---

## 2. Data Sources & Official Investigation

### Source A — Empowered Indian Public APIs
* **Completed Works:** `https://api.empoweredindian.in/api/works/completed?constituency=SHAHJAHANPUR&page=1&limit=100`
* **Individual Work Item:** `https://api.empoweredindian.in/api/works/completed/{mongo_id}`
* **MP Summaries:** `https://api.empoweredindian.in/api/summary/mps?page=1&limit=800`
* **Characteristics:** Provides itemized completed works with descriptions, cost, completion dates, constituency, MP details, category, district, and location. Provides 770+ MP performance summaries across Lok Sabha and Rajya Sabha.

### Source B — Official MoSPI / e-SAKSHI Portal (`https://mplads.mospi.gov.in`)
* **Investigation Result:** MoSPI's official pre-login dashboard exposes unauthenticated public REST endpoints:
  * `POST https://mplads.mospi.gov.in/rest/PreLoginDashboardData/getTilesData` (Allocated Limit, Expenditure, Recommended Works, Sanctioned Works, Completed Works)
  * `POST https://mplads.mospi.gov.in/rest/PreLoginDashboardData/getStateData` (State catalog)
  * `POST https://mplads.mospi.gov.in/rest/PreLoginDashboardData/getgraphdata` (Aggregated time series / categories)
* **Adapter Status:** Implemented as `MoSPIeSAKSHIAdapter`. It fetches and persists national macro benchmark indicators. Granular itemized work items on the portal are aggregated behind pre-login UI scripts.

---

## 3. Database Schema

The database models are designed strictly around actual fields discovered from the real APIs without fabricating values:

### `works`
* `id` (Integer PK)
* `work_id` (BigInteger, eSAKSHI Work ID)
* `source_id` (String, MongoDB ObjectId)
* `work_description` / `work_description_hi` (Text, PII-sanitized)
* `cost` (Float)
* `completion_date` (DateTime) / `completion_year` (Integer)
* `mp_name` / `mp_name_hi` (String, indexed)
* `constituency` / `constituency_hi` (String, indexed)
* `state` / `state_hi` (String, indexed)
* `house` (String)
* `category` / `category_hi` (String, indexed)
* `district` / `district_hi` (String, indexed)
* `location` / `location_hi` (Text, PII-sanitized)
* `beneficiaries` (Integer)
* `implementing_agency` / `implementing_agency_hi` (String, nullable)
* `quality_rating` (Float, nullable)
* `latitude` / `longitude` (Float, nullable)
* `photos_metadata` / `impact_metrics` (JSON, nullable)
* `source` (String, e.g. `empowered_indian`)
* `raw_data_path` (String)
* `created_at` / `last_updated` (DateTime)

### `mp_financial_summaries`
* `id` (Integer PK)
* `source_id` (String, indexed)
* `mp_name` (String, indexed)
* `house` (String)
* `state` / `constituency` (String, indexed)
* `allocated_amount` (Float)
* `total_expenditure` (Float)
* `total_recommended_amount` (Float)
* `utilization_percentage` / `recommendation_utilization_percentage` / `expenditure_percentage` (Float)
* `utilization_definition` (String)
* `completed_works_count` / `recommended_works_count` / `pending_works` (Integer)
* `completion_rate` / `payment_gap_percentage` (Float)
* `unspent_amount` / `unpaid_balance` (Float)
* `completed_works_value` / `total_completed_amount` / `in_progress_payments` (Float)
* `source` (String)
* `created_at` / `last_updated` (DateTime)

### `macro_metrics`
* `id` (Integer PK)
* `metric_key` (String, Unique)
* `metric_name` (String)
* `metric_value_raw` / `metric_value_crores` (String)
* `metric_count` (BigInteger)
* `source` (String)
* `last_updated` (DateTime)

---

## 4. Quickstart & Setup

### Prerequisites
* [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Compose v2)
* Python 3.12 (if running outside Docker)
* Node.js v18+ (if running outside Docker)

### 1. Configure Environment
```bash
cp .env.example .env
```

### 2. Start Application Containers
```bash
docker compose up -d --build
```

### 3. Run Data Ingestion
Run the ingestion CLI inside the backend container to pull live data from Empowered Indian and MoSPI eSAKSHI:

```bash
# Ingest all data (MoSPI macro metrics, 770+ MP summaries, and first 5 national pages / 500 completed works)
docker compose exec backend python ingest.py --all

# Ingest all 44,028 national completed works in batch mode:
docker compose exec backend python ingest.py --all-works

# Or ingest by state / constituency / max pages:
docker compose exec backend python ingest.py --state "Uttar Pradesh" --max-pages 10
docker compose exec backend python ingest.py --constituency MALKAJGIRI
```

---

## 5. API Endpoints

Interactive Swagger API docs are available at **[http://localhost:8000/docs](http://localhost:8000/docs)**.

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Service health status |
| `GET` | `/` | API status and root information |
| `POST` | `/api/sync` | Trigger synchronization (Supports optional query params: `constituency`, `state`, `max_pages` [default: 5 pages = max 500 works]) |
| `GET` | `/api/works` | Paginated list of works (Filters: `constituency`, `state`, `category`, `page`, `limit`) |
| `GET` | `/api/works/{work_id}` | Detailed record for a single work item (by `work_id` or `source_id`) |
| `GET` | `/api/mps` | Paginated MP financial summaries (Filters: `constituency`, `state`, `house`, `page`, `limit`) |
| `GET` | `/api/mps/{id}` | Detailed financial & execution summary for a single MP (by database `id` or `source_id`) |
| `GET` | `/api/dashboard` | Live aggregate analytics computed directly from stored PostgreSQL records |

---

## 6. Current Limitations & Future Data Requirements

* **Itemized Works Granularity:** Current Empowered Indian public APIs provide completed works for specific constituencies. Ingestion of ongoing/sanctioned individual work items is supported by the data schema as new source endpoints become available.
* **Cost Anomaly vs Cost Overrun:** The currently available data provides actual final completed cost. Because initial sanctioned estimates at the itemized level are not consistently exposed in the public completed works feed, cost variance analysis is categorized as **Cost Anomaly** detection rather than claiming "cost overrun".
* **Transaction-Level Payments:** MP summaries supply macro expenditure and in-progress payments, but not individual contractor invoice timestamps. Full payment delay analytics will plug into the adapter architecture when invoice-level feeds are connected.
* **Incidental PII:** Automatic regex sanitization protects incidental phone numbers and emails in descriptions/locations before storage and presentation.
