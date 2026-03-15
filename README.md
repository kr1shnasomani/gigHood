

# GigHood — AI-Powered Parametric Income Insurance for Gig Workers

> **Guidewire DEVTrails Hackathon 2026**  
> *Protecting gig worker income from external disruptions using AI-driven parametric insurance.*

---

## 💬 What Riders Say

</div>

---

<table>
<tr>
<td width="100" align="center" valign="top">
<br>
<img src="https://api.dicebear.com/7.x/personas/svg?seed=rider1" width="68" height="68" />
<br><br>
<b>⭐⭐⭐⭐⭐</b>
</td>
<td valign="top">
<br>

> *❝ When heavy rain hits the city, deliveries slow down or stop completely. That means losing an entire day's earnings. A safety net for days like this would make a huge difference for workers like us. ❞*

**Ravi Kumar**
<br>
🛵 Food Delivery Partner

</td>
</tr>
</table>

---

<table>
<tr>
<td width="100" align="center" valign="top">
<br>
<img src="https://api.dicebear.com/7.x/personas/svg?seed=rider2" width="68" height="68" />
<br><br>
<b>⭐⭐⭐⭐⭐</b>
</td>
<td valign="top">
<br>

> *❝ Some days the heat or pollution becomes unbearable. We cannot ride for long hours, but the bills don't stop. Income protection during such days would change everything. ❞*

**Arjun Singh**
<br>
🛒 Grocery Delivery Rider

</td>
</tr>
</table>

---

<table>
<tr>
<td width="100" align="center" valign="top">
<br>
<img src="https://api.dicebear.com/7.x/personas/svg?seed=rider3" width="68" height="68" />
<br><br>
<b>⭐⭐⭐⭐⭐</b>
</td>
<td valign="top">
<br>

> *❝ When sudden curfews or local shutdowns happen, deliveries stop and we lose the entire day's income. Having an automated insurance system for these disruptions would provide real peace of mind. ❞*

**Imran Shaikh**
<br>
📦 E-commerce Delivery Partner

</td>
</tr>
</table>

---

</div>
## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Solution Overview](#2-solution-overview)
3. [Persona & Scenario](#3-persona--scenario)
4. [Parametric Insurance Model](#4-parametric-insurance-model)
5. [Weekly Premium Model](#5-weekly-premium-model)
6. [Parametric Triggers](#6-parametric-triggers)
7. [AI/ML Integration](#7-aiml-integration)
8. [Application Workflow](#8-application-workflow)
9. [Tech Stack & Architecture](#9-tech-stack--architecture)
10. [Development Plan](#10-development-plan)
11. [Business Viability](#11-business-viability)
12. [Team](#12-team)

---

## 1. Problem Statement

India's gig economy employs **15+ million delivery workers**, powering platforms like Swiggy, Zomato, Zepto, Blinkit, and Amazon Flex. Despite being the backbone of India's on-demand economy, these workers have virtually no income protection.

### The Disruption Reality

| Disruption Event | Income Impact |
|---|---|
| Heavy Rain (>35mm/hr) | 50–80% drop in orders |
| Flood or Disaster Alert | Work stops completely |
| Heatwave (>44°C) | Unsafe working conditions |
| Hazardous AQI (>400) | Outdoor work impossible |
| Curfew / Bandh | Zero mobility, zero income |
| Platform Outage | No orders receivable |

A single disruption day causes a **₹600–₹1,200 income loss** for an average gig worker.

### Why Traditional Insurance Fails

- **Monthly premiums** do not match gig workers' weekly cash flow
- **Proof of income required** — gig workers lack formal employment records
- **Long claim settlement times** — workers cannot wait weeks for reimbursement
- **Manual claim filing** — workers lack time, documentation, and digital literacy for claim processes

### The Gap

```
< 3%   gig workers have any income protection
< 2    weeks of savings held by most workers
  0    insurance products designed specifically for gig workers
```

**Gig workers need instant income protection — not traditional insurance.**

---

## 2. Solution Overview

**GigHood** is an AI-powered parametric income insurance platform that automatically protects gig workers from income loss caused by external disruptions.

Instead of filing claims, payouts are **triggered automatically** when real-world conditions cross predefined thresholds. Workers subscribe to a weekly protection plan — the system handles all monitoring, validation, and payment.

### Core Principles

| Principle | Description |
|---|---|
| ✅ Income protection | Covers verified disruption-driven income loss |
| ✅ Weekly premium model | Matches gig workers' natural cash flow cycle |
| ✅ Automatic payouts | No claim filing — triggers execute instantly |
| ✅ Zero documentation | No salary slips, employment letters, or forms |
| ✅ AI-driven risk engine | Personalized pricing and fraud prevention |

### Platform Choice: Mobile-First (React Native)

We chose a **mobile application** over a web platform for the following reasons:

- **99% of gig workers** use smartphones exclusively — no laptops or desktops
- **UPI payment integration** is native to mobile, enabling frictionless ₹49 weekly payments
- **Push notifications** deliver real-time payout alerts and disruption warnings
- **GPS access** enables zone-level disruption detection and fraud prevention
- **WhatsApp API integration** allows policy updates through familiar interfaces
- **Offline-first design** handles intermittent connectivity during field conditions

A web admin dashboard is built separately for insurers, underwriters, and operations teams.

---

## 3. Persona & Scenario

### Ravi Kumar — Primary Persona

| Attribute | Detail |
|---|---|
| Age | 26 |
| City | Bengaluru |
| Platforms | Swiggy & Zomato |
| Weekly Income | ₹4,500 (average) |
| Best Week | ₹6,200 |
| Worst Monsoon Week | ₹1,800 |
| Vehicle | 2-wheeler |
| Device | Android smartphone |
| Payment Method | UPI |

> *"If rain stops orders for two days, I cannot pay rent."*

### Ravi's Workflow with GigHood

```
Monday Morning
└── Ravi opens GigHood app
└── AI engine displays his weekly risk score based on weather forecast
└── Ravi selects "Pro Plan" — ₹129/week, max payout ₹2,000
└── Payment deducted via UPI
└── Policy activates instantly

Wednesday — Sudden Heavy Rain
└── OpenWeatherMap detects rainfall >35mm/hr in Ravi's zone
└── AI Trigger Engine confirms threshold breach
└── Fraud engine validates Ravi's GPS location and work history
└── Fraud Risk Score: 18 → Auto-approved
└── ₹800 payout dispatched to Ravi's UPI ID

Wednesday Evening
└── Ravi receives WhatsApp notification: "₹800 credited — stay safe"
└── Zero action required from Ravi
```

### Additional Persona — Priya Devi (Chennai)

| Attribute | Detail |
|---|---|
| Age | 31 | 
| City | Chennai |
| Platform | Amazon Flex |
| Key Risk | Cyclone season + coastal flooding |

GigHood automatically recommends **Rain + Cyclone coverage** for Priya based on her city's regional risk profile, without requiring her to understand policy terms.

---

## 4. Parametric Insurance Model

### Traditional vs. Parametric

| Dimension | Traditional Insurance | Parametric Insurance (GigHood) |
|---|---|---|
| Trigger | Individual loss verified | External event threshold |
| Claim filing | Manual, documented | None required |
| Settlement time | Weeks to months | Minutes |
| Proof required | Extensive documentation | Zero |
| Fraud surface | High (self-reported loss) | Low (objective data) |
| Suitable for gig workers | No | Yes |

### How It Works

```
External event detected (e.g., heavy rain in Bengaluru)
         │
         ▼
AI engine validates threshold (rainfall > 35mm/hr confirmed)
         │
         ▼
Policy eligibility checked (active policy in affected zone)
         │
         ▼
Fraud Risk Score computed (GPS, history, behavior)
         │
         ▼
Payout amount calculated (tier × disruption severity)
         │
         ▼
UPI transfer executed automatically
         │
         ▼
Worker notified via WhatsApp + push notification
```

**No claim. No form. No delay.**

---

## 5. Weekly Premium Model

Gig workers earn weekly, face weekly expenses, and budget weekly. Monthly premiums create a structural mismatch. GigHood aligns with how gig workers actually manage money.

### Protection Tiers

| Tier | Weekly Premium | Max Weekly Payout | Coverage Ratio |
|---|---|---|---|
| Basic | ₹49 | ₹800 | 16.3x |
| Pro | ₹129 | ₹2,000 | 15.5x |
| Max | ₹249 | ₹4,000 | 16.1x |

### Dynamic Premium Pricing

Premiums are not fixed — they are recalculated each week based on multiple signals:

| Factor | Impact on Premium |
|---|---|
| City risk level | Higher disruption cities → higher base premium |
| Season | Monsoon, winter pollution season → surge pricing |
| Worker history | Low-claim history → loyalty discount |
| Predicted disruption probability | AI forecast → real-time adjustment |
| Platform activity | Active workers eligible; inactive accounts paused |

**Example:** Ravi in Bengaluru during peak monsoon (July) may see Pro plan at ₹149 instead of ₹129, reflecting elevated flood risk. Conversely, in dry season, the same plan may drop to ₹109.

### Weather-Adaptive Regional Recommendations

| Region | Primary Risk | Recommended Coverage |
|---|---|---|
| Delhi (Oct–Feb) | AQI spikes | AQI protection add-on |
| Mumbai (Jun–Sep) | Monsoon + flooding | Flood coverage |
| Chennai (Nov–Dec) | Cyclone + rain | Rain + cyclone bundle |
| Rajasthan (Apr–Jun) | Extreme heat | Heatwave protection |
| Bengaluru (Jun–Sep) | Monsoon disruption | Rain + traffic bundle |

The app surfaces these recommendations contextually — workers are never asked to interpret weather risk themselves.

---

## 6. Parametric Triggers

GigHood monitors multiple real-world signals continuously. Payouts activate automatically when thresholds are crossed.

| Trigger | Threshold | Data Source | Payout Condition |
|---|---|---|---|
| Heavy Rain | Rainfall > 35mm/hr | OpenWeatherMap API | Worker in active zone |
| Flood Alert | Disaster warning issued | NDMA API | Zone matches worker location |
| Extreme Heat | Heat index > 44°C | IMD API | Active policy + shift hours |
| Hazardous AQI | AQI > 400 | CPCB API | Worker in affected city |
| Curfew / Bandh | Government restriction | News APIs + NLP | Zone lockdown confirmed |
| Major Traffic Shutdown | Critical road closure | Google Maps API | Worker zone impacted |
| Platform Outage | Delivery app unavailable | Platform health check | Worker's primary platform |
| Cyclone Warning | Cyclone within 100km | IMD Cyclone API | Worker in impact radius |

### Multi-Trigger Events

When multiple triggers activate simultaneously (e.g., cyclone + flood + platform outage), payouts are additive up to the weekly maximum for the worker's tier. The AI engine applies a **disruption severity multiplier** to scale payouts proportionally.

---

## 7. AI/ML Integration

AI is not a feature layer in Equix — it is the operational core. Every key decision is model-driven.

### ML Modules

| Module | Model | Purpose |
|---|---|---|
| Risk Prediction | XGBoost | Predict weekly disruption probability per zone |
| Weather Forecasting | LSTM (time-series) | 7-day rainfall, AQI, temperature forecasting |
| Premium Pricing | Regression + XGBoost | Dynamic weekly premium computation |
| Fraud Detection | Isolation Forest | Anomaly detection on claims and location data |
| Worker Segmentation | K-Means Clustering | Behavior-based risk profiling |
| Payout Optimization | Reinforcement Learning | Maximize coverage fairness within loss limits |

### ML Pipeline

```
External APIs (Weather, NDMA, CPCB, Maps)
              │
              ▼
       Data Ingestion Layer
              │
              ▼
      Feature Engineering
   (zone, weather, time, history)
              │
              ▼
      Risk Prediction Model
       (XGBoost — per zone)
              │
              ▼
       Trigger Detection
   (threshold validation engine)
              │
              ▼
       Fraud Scoring Engine
     (Isolation Forest + rules)
              │
              ▼
     Automatic Payout Decision
              │
              ▼
    Payment Service (Razorpay/UPI)
```

### Premium Calculation — AI Workflow

1. Worker's city, zone, and season are extracted
2. LSTM model generates 7-day weather forecast for the zone
3. Historical disruption data for that zone is retrieved
4. XGBoost model scores disruption probability (0.0–1.0)
5. Actuarial model maps probability to expected loss
6. Premium is set as: `base_premium × city_risk_factor × season_multiplier × worker_loyalty_discount`
7. Premium is shown to worker before payment

### Fraud Detection — Detail

Each potential payout is scored using a **Fraud Risk Score (FRS)** from 0 to 100.

| Score Range | Action |
|---|---|
| 0–30 | Auto-approve |
| 31–55 | Approve + passive monitoring |
| 56–70 | Additional verification (OTP / selfie) |
| 71–85 | Manual review queue |
| 86–100 | Auto-reject, flag for investigation |

**Fraud signals detected:**

| Signal | Detection Method |
|---|---|
| GPS spoofing | Trajectory velocity analysis |
| Duplicate accounts | Device fingerprinting + Aadhaar hash |
| Zone hopping | Location history cross-validation |
| Claim surge anomalies | Isolation Forest on cluster behavior |
| Platform activity mismatch | Cross-reference with platform API data |

Models retrain continuously on new labeled data, improving accuracy over time.

### Voice AI Assistant

Many gig workers prefer voice interaction over reading policy text. Equix includes a **GenAI-powered voice assistant**:

- Worker speaks naturally: *"What happens if it rains tomorrow?"*
- Speech-to-text converts audio to query
- LLM (Claude / GPT-4) generates a plain-language response
- Text-to-speech delivers the answer in the worker's language

Supported languages: Hindi, Kannada, Tamil, Telugu, English

### Government Scheme Discovery

Equix integrates a live scheme discovery module that surfaces relevant benefits:

- **e-Shram** accident and disability coverage
- State-level gig worker welfare funds
- PM Suraksha Bima Yojana eligibility
- Platform-specific insurance partnerships

Workers receive personalized, actionable scheme suggestions based on their profile.

---

## 8. Application Workflow

### Worker Onboarding Flow

```
1. Download Equix app
2. Register with mobile number + Aadhaar OTP
3. Select delivery platform(s)
4. AI generates personalized risk profile
5. Recommended plan displayed with regional risk reasoning
6. Worker selects plan + pays via UPI (auto-debit enabled)
7. Policy active — worker protected
```

### Weekly Policy Cycle

```
Monday: Premium deducted automatically (auto-debit or UPI mandate)
         └── Policy active for 7 days

During week: AI monitors all trigger conditions in real-time
              └── Any threshold breach → payout initiated automatically

Sunday: Policy summary sent (disruptions covered, payouts made, next week preview)
         └── Option to upgrade / downgrade plan
```

### Payout Flow (End-to-End)

```
Trigger event detected (e.g., rain alert)
└── Zone mapping: worker's current GPS zone matched
└── Policy check: active policy confirmed
└── Fraud score computed: < 30 → auto-approve
└── Payout amount: tier × severity multiplier
└── Payment: Razorpay UPI transfer initiated
└── Confirmation: WhatsApp + push notification
Total time: < 90 seconds from trigger detection to payout
```

---

## 9. Tech Stack & Architecture

### Technology Stack

| Layer | Technology | Justification |
|---|---|---|
| Mobile App | React Native | Cross-platform (Android + iOS), single codebase |
| Admin Dashboard | React + Tailwind CSS | Fast, component-driven UI for operations team |
| API Gateway | Kong / AWS API Gateway | Rate limiting, auth, routing |
| Backend Services | FastAPI (Python) + Node.js | FastAPI for ML-heavy services; Node.js for real-time |
| ML Models | XGBoost, PyTorch (LSTM) | Industry-standard for tabular + time-series ML |
| Database | PostgreSQL + TimescaleDB | Relational + time-series data (weather, claims) |
| Cache | Redis | Sub-millisecond trigger detection |
| Payments | Razorpay | UPI, auto-debit mandate, instant settlement |
| Notifications | WhatsApp Business API + FCM | Reach workers on familiar channels |
| Cloud | AWS (ECS, RDS, S3, Lambda) | Managed, scalable, India region |
| CI/CD | GitHub Actions + Docker | Automated testing and container deployment |

### System Architecture

```
┌─────────────────────────────────────────────────┐
│               Gig Worker (Mobile App)            │
│                  React Native                    │
└────────────────────┬────────────────────────────┘
                     │ HTTPS
                     ▼
┌─────────────────────────────────────────────────┐
│                  API Gateway                     │
│         (Auth, Rate Limiting, Routing)           │
└───┬──────────┬──────────┬──────────┬────────────┘
    │          │          │          │
    ▼          ▼          ▼          ▼
┌───────┐ ┌───────┐ ┌─────────┐ ┌────────┐
│Policy │ │AI Risk│ │Trigger  │ │Payment │
│Engine │ │Engine │ │Monitor  │ │Service │
└───────┘ └───────┘ └────┬────┘ └────────┘
                          │
              ┌───────────┼───────────┐
              ▼           ▼           ▼
        ┌──────────┐ ┌────────┐ ┌──────────┐
        │ Weather  │ │ NDMA   │ │ CPCB/IMD │
        │   API    │ │  API   │ │   API    │
        └──────────┘ └────────┘ └──────────┘

┌─────────────────────────────────────────────────┐
│              Data Layer                         │
│   PostgreSQL  │  TimescaleDB  │  Redis Cache    │
└─────────────────────────────────────────────────┘
```

### Microservices Breakdown

| Service | Responsibility |
|---|---|
| **Policy Engine** | Plan management, activation, renewal |
| **AI Risk Engine** | Risk scoring, premium calculation, ML inference |
| **Trigger Monitor** | Real-time API polling, threshold evaluation |
| **Claim Engine** | Payout orchestration, amount calculation |
| **Fraud Detection** | FRS computation, anomaly flagging |
| **Payment Service** | Razorpay UPI integration, settlement |
| **Notification Service** | WhatsApp + FCM push delivery |
| **Auth Service** | Aadhaar OTP, JWT, device fingerprinting |

---

## 10. Development Plan

### Phase 1 — Ideation & Foundation (Weeks 1–2) ✅ *Current*

- [x] Problem research and persona development
- [x] Parametric trigger design and threshold definition
- [x] Weekly premium model and tier structure
- [x] Platform architecture decisions (mobile-first)
- [x] AI/ML module design
- [x] README and repository setup

### Phase 2 — Core Development (Weeks 3–5)

- [ ] Backend API scaffolding (FastAPI + Node.js)
- [ ] Database schema design (PostgreSQL + TimescaleDB)
- [ ] ML pipeline setup (data ingestion + feature store)
- [ ] External API integrations (OpenWeatherMap, NDMA, CPCB, IMD)
- [ ] Trigger detection engine (real-time polling + threshold logic)
- [ ] Basic mobile app screens (onboarding, policy, dashboard)

### Phase 3 — AI/ML Integration (Weeks 6–8)

- [ ] XGBoost risk prediction model (training + deployment)
- [ ] LSTM weather forecasting model
- [ ] Dynamic premium pricing engine
- [ ] Isolation Forest fraud detection model
- [ ] K-Means worker segmentation
- [ ] Fraud Risk Score (FRS) pipeline

### Phase 4 — Payment & Automation (Weeks 9–10)

- [ ] Razorpay UPI integration (one-time + auto-debit mandate)
- [ ] End-to-end claim automation (trigger → fraud score → payout)
- [ ] WhatsApp notification integration
- [ ] Admin dashboard (real-time analytics + manual review queue)

### Phase 5 — Testing & Demo Preparation (Weeks 11–12)

- [ ] End-to-end integration testing
- [ ] Load testing (simulate 10,000 concurrent trigger events)
- [ ] Demo scenario scripting and data seeding
- [ ] Voice AI assistant integration
- [ ] Government scheme discovery module
- [ ] Final submission preparation

---

## 11. Business Viability

### Market Opportunity

| Metric | Value |
|---|---|
| Current gig workforce (India) | 15M+ |
| Projected workforce by 2030 | 23.5M |
| Addressable workers (digital UPI) | 8M |
| Estimated annual market size | ₹6,000+ crore |

### Revenue Streams

| Stream | Model |
|---|---|
| Weekly premiums | Primary — B2C subscription |
| Platform partnerships | B2B — Swiggy, Zomato white-label |
| Insurance APIs | B2B — Sell trigger engine to other insurers |
| Analytics insights | SaaS — Disruption data to urban planners |

### Unit Economics (Pro Tier Example)

```
Weekly premium:       ₹129
Expected payout:      ₹129 × loss ratio (target 65%) = ₹83.85
Operating cost/user:  ₹15
Gross margin:         ₹30.15 per worker per week

At 100,000 active workers: ₹3 crore+ gross margin per week
```

---

## 12. Repository Structure

```
gighood/
├── README.md
├── docker-compose.yml
├── .github/
│   └── workflows/
│       └── ci.yml
├── apps/
│   ├── mobile/              # React Native app
│   └── dashboard/           # React admin dashboard
├── services/
│   ├── api-gateway/
│   ├── policy-engine/
│   ├── ai-risk-engine/
│   ├── trigger-monitor/
│   ├── claim-engine/
│   ├── fraud-detection/
│   └── payment-service/
├── ml/
│   ├── models/
│   │   ├── risk_prediction/
│   │   ├── weather_forecast/
│   │   ├── fraud_detection/
│   │   └── premium_pricing/
│   ├── pipelines/
│   └── notebooks/
└── infra/
    ├── terraform/
    └── kubernetes/
```

## Getting Started

```bash
# Clone the repository
git clone https://github.com/your-repo/gighood

# Navigate to project root
cd gighood

# Start all services
docker-compose up

# Backend API
http://localhost:8000

# Admin Dashboard
http://localhost:3000

# API Documentation
http://localhost:8000/docs
```

---

## 13. Team

**GigHood Team — Guidewire DEVTrails Hackathon 2026**

Building the future of financial protection for gig workers in India through AI-powered parametric income insurance.

| Name | Role |
|---|---|
| Vishnu Gupta |  Team Leader |
| Abhay Kumar | Team Member |
| Ananya Agarwal | Team Member |
| Krishna Somani | Team Member |
| Praveen Kumar | Team Member |

---

<div align="center">

**GigHood — Protecting Gig Worker Income with AI**

*No claims. No forms. No delays. Just protection.*

</div>
