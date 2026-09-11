# JanDrishti Risk Engine — Implementation Walkthrough

## Overview

The **Risk Engine & Risk API** modules have been fully adapted to the final **JanDrishti Integration Contract** on branch `feature/jayant-risk-engine`.

The system provides a canonical, deterministic, and explainable multi-signal risk evaluation on a **0–100 scale**, perfectly compatible with:
1. **Akshansh's anomaly detection modules** (`ml_anomaly_score`, `cost_anomaly_score`, `utilization_score`)
2. **Nitin's detection modules** (`duplicate_score`, `geographic_score`, `data_quality_score`)
3. **Akanksha's Investigation Agent** (`RiskEngine.compute_risk(signals)` adapter in `tools.py`)

```
MPLADS Data (Works DB) ──┐
                         ▼
             Normalized Signals (0–100)
    ┌────────────────────┬────────────────────┐
    │ ml_anomaly: 25%    │ cost_anomaly: 25%  │
    │ duplicate: 20%     │ utilization: 15%   │
    │ geographic: 10%    │ data_quality: 5%   │
    └────────────────────┴────────────────────┘
                         │
                         ▼
        [ml/risk_engine.py] (RiskEngine)
    • Dynamic weight renormalization for missing signals
    • Deterministic 0–100 score + safe observations
    • Top risk factor ranking
                         │
         ┌───────────────┴───────────────┐
         ▼                               ▼
 [Investigation Agent]          [backend/app/services/risk/service.py] (RiskService)
  Tool 8: get_risk_breakdown                     │
                                                 ▼
                                     [backend/app/routes/risk.py]
                                     • POST /api/risk/evaluate
                                     • POST /api/risk/evaluate/batch
                                     • GET  /api/risk/alerts
                                     • GET  /api/risk/config
                                     • GET  /api/risk/{work_id}
```

---

## Deliverables & Architecture

### 1. Canonical ML Risk Engine ([`ml/risk_engine.py`](ml/risk_engine.py))
- **`RiskEngine.compute_risk(signals)`**: Pure, deterministic function accepting dictionaries or pandas DataFrames.
- **Product Weights**:
  - `ml_anomaly_score`: 25% (`0.25`)
  - `cost_anomaly_score`: 25% (`0.25`)
  - `duplicate_score`: 20% (`0.20`)
  - `utilization_score`: 15% (`0.15`)
  - `geographic_score`: 10% (`0.10`)
  - `data_quality_score`: 5% (`0.05`)
- **Missing Signal Renormalization**: If any signal is missing or `None`, its weight is excluded from the denominator:
  $$\text{effective\_weight}_i = \frac{\text{configured\_weight}_i}{\sum_{j \in \text{available}} \text{configured\_weight}_j}$$
  $$\text{overall\_score} = \sum_{i \in \text{available}} \text{score}_i \times \text{effective\_weight}_i$$
- **Missing vs. Zero Distinction**: Verified that `0.0` actively pulls down the weighted average, whereas `None` leaves the denominator to remaining signals.
- **All Signals Missing**: Safely returns `overall_score: null`, `risk_level: "Insufficient Data"`, empty breakdown, empty top factors, and observation: *"Insufficient risk signals available for assessment."*
- **Risk Bands**:
  - `0 – 30`: `"Low"`
  - `31 – 60`: `"Medium"`
  - `61 – 80`: `"High"`
  - `81 – 100`: `"Critical"`
- **Top Risk Factors**: Returns an array of signal keys ordered by descending weighted contribution.
- **Safe Observations**: Generates explainable findings adhering strictly to non-accusatory standards (never claiming "fraud", "corruption", or guilt).

---

### 2. Service Layer ([`backend/app/services/risk/service.py`](backend/app/services/risk/service.py))
- **`RiskService`**: Thin coordinator bridging the application layer with `ml.risk_engine.RiskEngine`, `Work` database lookups, and `AlertManager`.
- Exposes `calculate_for_work` and `calculate_batch`.
- Connects to existing SQLAlchemy `Work` model without inventing columns.

---

### 3. Pydantic Schemas ([`backend/app/schemas/risk.py`](backend/app/schemas/risk.py))
- `RiskEvaluationResponse`:
  - `work_id`: `str`
  - `overall_score`: `Optional[float]`
  - `risk_level`: `str`
  - `confidence`: `float`
  - `signal_breakdown`: `Dict[str, SignalBreakdownItem]`
  - `observations`: `List[str]`
  - `top_risk_factors`: `List[str]`
  - `human_review_required`: `bool`
  - `alert_required`: `bool`
  - `alert`: `Optional[RiskAlertDetail]`
  - `evidence`: `List[EvidenceItem]`
  - `metadata`: `Optional[Dict[str, Any]]`
  - `evaluated_at`: `str`
- Backward compatibility aliases (`risk_score`, `reasons`, `contributing_signals`, `confidence_score`) are preserved for existing frontends.
- `RiskEngineConfigResponse`: Exposes transparent weights (25/25/20/15/10/5) and thresholds (30, 60, 80, 70).

---

### 4. REST API Routes ([`backend/app/routes/risk.py`](backend/app/routes/risk.py))
Registered under prefix `/api` in [`backend/app/main.py`](backend/app/main.py):

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/risk/evaluate` | Evaluates single work item on 0–100 scale; returns 400 on invalid signals. |
| `POST` | `/api/risk/evaluate/batch` | Evaluates multiple work items in a single request. |
| `GET` | `/api/risk/alerts` | Queries generated alerts with filters (`min_score`, `level`, `work_id`, `limit`). |
| `GET` | `/api/risk/config` | Returns transparent engine weights, thresholds, and band definitions. |
| `GET` | `/api/risk/{work_id}` | Retrieves risk evaluation for a stored database record; returns 404 if work is not found. |

---

## Verification & Test Results

### 1. Automated Test Suite (24 / 24 Passed)
Command:
```powershell
$env:PYTHONPATH="backend;.venv"; .venv\Scripts\python -m pytest backend/tests/test_risk_engine.py backend/tests/test_risk_api.py -v
```

Execution Output:
```
============================= test session starts =============================
platform win32 -- Python 3.12.4, pytest-9.1.1, pluggy-1.6.0
rootdir: C:\Users\jayan\Desktop\JD\JanDrishti
collected 24 items

backend/tests/test_risk_engine.py::TestRiskEngineCanonical::test_01_all_six_signals_available PASSED [  4%]
backend/tests/test_risk_engine.py::TestRiskEngineCanonical::test_02_all_signals_zero PASSED [  8%]
backend/tests/test_risk_engine.py::TestRiskEngineCanonical::test_03_all_signals_hundred PASSED [ 12%]
backend/tests/test_risk_engine.py::TestRiskEngineCanonical::test_04_correct_weighted_calculation PASSED [ 16%]
backend/tests/test_risk_engine.py::TestRiskEngineCanonical::test_05_missing_geographic_signal_renormalization PASSED [ 20%]
backend/tests/test_risk_engine.py::TestRiskEngineCanonical::test_06_multiple_missing_signals PASSED [ 25%]
backend/tests/test_risk_engine.py::TestRiskEngineCanonical::test_07_all_signals_missing_returns_insufficient_data PASSED [ 29%]
backend/tests/test_risk_engine.py::TestRiskEngineCanonical::test_08_invalid_values_rejected PASSED [ 33%]
backend/tests/test_risk_engine.py::TestRiskEngineCanonical::test_09_boolean_signal_handling PASSED [ 37%]
backend/tests/test_risk_engine.py::TestRiskEngineCanonical::test_10_risk_boundary_behavior PASSED [ 41%]
backend/tests/test_risk_engine.py::TestRiskEngineCanonical::test_11_engine_determinism PASSED [ 45%]
backend/tests/test_risk_engine.py::TestRiskEngineCanonical::test_12_signal_breakdown_structure PASSED [ 50%]
backend/tests/test_risk_engine.py::TestRiskEngineCanonical::test_13_top_risk_factors_ranking PASSED [ 54%]
backend/tests/test_risk_engine.py::TestRiskEngineCanonical::test_14_safe_non_accusatory_language PASSED [ 58%]
backend/tests/test_risk_engine.py::TestRiskEngineCanonical::test_15_alert_generation_condition PASSED [ 62%]
backend/tests/test_risk_engine.py::TestRiskEngineCanonical::test_16_investigation_agent_compatibility PASSED [ 66%]
backend/tests/test_risk_api.py::TestRiskAPIsIntegration::test_01_post_evaluate_endpoint PASSED [ 70%]
backend/tests/test_risk_api.py::TestRiskAPIsIntegration::test_02_post_evaluate_invalid_signal_returns_400 PASSED [ 75%]
backend/tests/test_risk_api.py::TestRiskAPIsIntegration::test_03_post_evaluate_batch PASSED [ 79%]
backend/tests/test_risk_api.py::TestRiskAPIsIntegration::test_04_get_alerts_endpoint PASSED [ 83%]
backend/tests/test_risk_api.py::TestRiskAPIsIntegration::test_05_get_config_endpoint PASSED [ 87%]
backend/tests/test_risk_api.py::TestRiskAPIsIntegration::test_06_get_work_risk_endpoint_existing PASSED [ 91%]
backend/tests/test_risk_api.py::TestRiskAPIsIntegration::test_07_get_work_risk_endpoint_not_found PASSED [ 95%]
backend/tests/test_risk_api.py::TestRiskAPIsIntegration::test_08_existing_endpoints_unbroken PASSED [100%]

======================= 24 passed, 4 warnings in 0.93s ========================
```

---

### 2. Direct Investigation Agent Compatibility Verification
Command:
```powershell
.venv\Scripts\python -c "from ml.risk_engine import RiskEngine; e = RiskEngine(); r = e.compute_risk({'ml_anomaly_score': 80, 'cost_anomaly_score': 90, 'duplicate_score': 30, 'utilization_score': 70, 'geographic_score': 60, 'data_quality_score': 40}); print('Score:', r['overall_score'], 'Level:', r['risk_level'], 'Top:', r['top_risk_factors']); assert 0 <= r['overall_score'] <= 100"
```
Output:
```
Score: 67.0 Level: High Top: ['cost_anomaly_score', 'ml_anomaly_score', 'utilization_score', 'geographic_score', 'duplicate_score', 'data_quality_score']
```
Direct verification with pandas DataFrame input:
```
DataFrame input test: PASSED
```

---

## Final Checklist

- [x] Canonical `ml/risk_engine.py` implemented and functional
- [x] `RiskEngine.compute_risk(signals)` canonical interface implemented
- [x] Six official signals supported: `ml_anomaly_score`, `cost_anomaly_score`, `duplicate_score`, `utilization_score`, `geographic_score`, `data_quality_score`
- [x] Scores and outputs operate on 0–100 scale
- [x] Final product weights implemented (25%, 25%, 20%, 15%, 10%, 5%)
- [x] Missing signals not treated as zero; weights renormalized
- [x] Actual zero distinguishes from missing
- [x] Risk bands implemented (0–30 Low, 31–60 Medium, 61–80 High, 81–100 Critical)
- [x] All signals missing returns `"Insufficient Data"` and `overall_score: null`
- [x] Signal breakdown with score, weights, and weighted contributions returned
- [x] `top_risk_factors` returned
- [x] Explainable observations generated using safe, non-accusatory language
- [x] Alerts triggered on score $\ge 70$ or High/Critical
- [x] Dedicated `RiskService` in `backend/app/services/risk/service.py` implemented
- [x] Pydantic schemas updated in `backend/app/schemas/risk.py`
- [x] REST routes updated in `backend/app/routes/risk.py`
- [x] Router registered in `backend/app/main.py`
- [x] Existing routes (`/health`, `/`, etc.) unbroken
- [x] Investigation Agent adapter verified
- [x] 24 unit & integration tests written and passing
- [x] Git branch `feature/jayant-risk-engine` established
