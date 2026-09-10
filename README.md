# JanDrishti

JanDrishti is an AI-powered MPLADS (Member of Parliament Local Area Development Scheme) monitoring platform that analyzes MPLADS work allocations, execution timelines, and financial expenditure data to identify unusual patterns, potential duplicate/similar works, data-quality issues, and composite risk levels.

> **Note on Risk Assessment:** JanDrishti provides data-driven risk indicators and investigation support. Anomaly flags and risk scores indicate statistical outliers and data discrepancies for human review; they do **not** claim that an anomaly proves fraud.

---

## 1. High-Level Architecture

* **Backend:** Python 3.12, FastAPI, SQLAlchemy ORM, Pydantic data validation.
* **Database:** PostgreSQL 16 (persisted via Docker named volume).
* **Machine Learning & Analytics:** Scikit-learn, Pandas, NumPy (anomaly detection, duplicate work detection, composite risk calculation).
* **Frontend:** React 18, Vite, Recharts (analytics charts), React Leaflet (geo-spatial map visualization).
* **Orchestration:** Docker & Docker Compose.

---

## 2. Prerequisites

Ensure you have the following installed on your development machine:
* [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Docker Compose)
* [Node.js](https://nodejs.org/) v18+ (for local frontend development outside Docker)
* [Python](https://www.python.org/) 3.12 (for local backend development outside Docker)

---

## 3. Environment Setup

Copy the sample environment file to `.env`:

```bash
cp .env.example .env
```

Adjust the values in `.env` if necessary.

---

## 4. Running the Application with Docker

Start all services (PostgreSQL 16, FastAPI backend, and React frontend) with a single command:

```bash
docker compose up --build
```

To run in the background (detached mode):

```bash
docker compose up -d --build
```

To stop all running services:

```bash
docker compose down
```

---

## 5. Application URLs

* **Frontend Application:** [http://localhost:5173](http://localhost:5173)
* **Backend API Root:** [http://localhost:8000](http://localhost:8000)
* **Interactive Swagger UI (API Docs):** [http://localhost:8000/docs](http://localhost:8000/docs)
* **Alternative API Docs (ReDoc):** [http://localhost:8000/redoc](http://localhost:8000/redoc)
* **PostgreSQL (Host Port):** `localhost:5433` (avoiding local port 5432 conflicts)

---

## 6. Project Structure

```
JanDrishti/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── config.py             # Environment & settings configuration
│   │   ├── database.py           # SQLAlchemy engine & session dependency
│   │   ├── main.py               # FastAPI entrypoint, middleware, routes
│   │   ├── models/               # SQLAlchemy ORM models
│   │   │   └── __init__.py
│   │   ├── schemas/              # Pydantic schemas for data validation
│   │   │   └── __init__.py
│   │   ├── routes/               # API endpoint route modules
│   │   │   └── __init__.py
│   │   ├── services/             # Core business logic
│   │   │   ├── __init__.py
│   │   │   ├── ingestion/        # MPLADS data extraction & loading
│   │   │   ├── anomaly/          # Anomaly detection logic
│   │   │   ├── duplicate/        # Duplicate work identification
│   │   │   ├── risk/             # Composite risk calculation
│   │   │   └── agent/            # Investigation assistant services
│   │   └── utils/                # Helper functions & utilities
│   │       └── __init__.py
│   ├── requirements.txt          # Python dependencies
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── components/           # Reusable UI components
│   │   ├── pages/                # Page views
│   │   ├── services/             # API client & services
│   │   ├── App.jsx               # Main React component & health check
│   │   ├── main.jsx              # Vite React DOM entry
│   │   └── index.css             # Base styles
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── Dockerfile
│
├── ml/
│   ├── __init__.py
│   ├── anomaly_detection.py      # Statistical & ML anomaly detection pipeline
│   ├── duplicate_detection.py    # Text & geospatial similarity detection
│   └── risk_engine.py            # Composite risk calculation engine
│
├── data/
│   ├── raw/                      # Unprocessed MPLADS datasets
│   └── processed/                # Cleaned & feature-engineered data
│
├── docker-compose.yml            # Multi-container setup (DB, Backend, Frontend)
├── .env.example                  # Environment variable template
├── .gitignore                    # Git ignore rules
└── README.md                     # Project overview & developer guide
```

---

## 7. Development Guidelines

* **Backend Development:** Place new route handlers in `backend/app/routes/`, models in `backend/app/models/`, and schemas in `backend/app/schemas/`.
* **ML Pipelines:** Implement model training, scoring, and evaluation in `ml/`. Export reusable scoring functions to `backend/app/services/`.
* **Frontend Components:** Build UI widgets and data tables in `frontend/src/components/`, and integrate API calls through `frontend/src/services/`.
