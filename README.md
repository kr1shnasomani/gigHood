# Guidewire_DEVTrails

<div align="center">

<br/>

```
 █████╗ ███████╗ ██████╗ ██╗███████╗
██╔══██╗██╔════╝██╔════╝ ██║██╔════╝
███████║█████╗  ██║  ███╗██║███████╗
██╔══██║██╔══╝  ██║   ██║██║╚════██║
██║  ██║███████╗╚██████╔╝██║███████║
╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚═╝╚══════╝
```

### **AI-Powered Income Protection Platform for Gig Workers**

<br/>

[![Status](https://img.shields.io/badge/Status-Active%20Development-brightgreen?style=for-the-badge)](.)
[![Hackathon](https://img.shields.io/badge/Hackathon-Phase%201-orange?style=for-the-badge)](.)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-purple?style=for-the-badge)](CONTRIBUTING.md)

<br/>

> *Protecting the income of millions of gig workers through AI-driven parametric insurance — no paperwork, no waiting, no uncertainty.*

<br/>

---

</div>

## 📋 Table of Contents

- [Overview](#-overview)
- [The Problem](#-the-problem)
- [Our Solution](#-our-solution)
- [Target Persona](#-target-persona)
- [How It Works](#-how-it-works)
- [Insurance Plans](#-insurance-plans)
- [Parametric Trigger Model](#-parametric-trigger-model)
- [AI & ML Integration](#-ai--ml-integration)
- [Seasonal Risk Recommendation](#-seasonal-risk-recommendation)
- [Technology Stack](#-technology-stack)
- [System Architecture](#-system-architecture)
- [Repository Structure](#-repository-structure)
- [Development Roadmap](#-development-roadmap)
- [Expected Impact](#-expected-impact)
- [Getting Started](#-getting-started)
- [Demo](#-demo)
- [Team](#-team)

---

## 🌐 Overview

**AEGIS** is an AI-powered **parametric micro-insurance platform** built specifically for gig economy workers — food delivery riders, ride-sharing drivers, street vendors, and anyone whose income depends on working outdoors every single day.

When heavy rain, extreme heat, flooding, or civil disruptions stop gig workers from earning, AEGIS automatically detects the disruption and **credits income protection payouts directly to the worker — no claims form, no agent visit, no delay.**

AEGIS combines real-time environmental monitoring, AI-driven risk prediction, and a weekly micro-premium model to make insurance accessible, affordable, and genuinely useful for the bottom of the economic pyramid.

---

## 🔴 The Problem

Over **50 million gig workers** in India alone depend on daily earnings with zero financial safety net. Their income is uniquely vulnerable to disruptions that are entirely outside their control:

| Disruption Type | Examples |
|---|---|
| 🌧️ Weather Events | Heavy rainfall, flooding, extreme heat, severe air pollution |
| 🚫 Civil Disruptions | Local strikes, curfews, zone closures |
| 🏗️ Infrastructure Failures | Traffic gridlock, metro shutdowns, power outages |

**The core gap:**

Unlike salaried employees, gig workers have:
- ❌ No fixed salary guarantee
- ❌ No employer-provided insurance
- ❌ No access to social security schemes
- ❌ No way to predict or recover from lost workdays

A single disrupted day can mean skipped meals, missed rent, or loans taken at predatory interest rates. AEGIS exists to close this gap permanently.

---

## ✅ Our Solution

AEGIS is an **AI-powered parametric insurance platform** with the following core capabilities:

```
┌─────────────────────────────────────────────────────────┐
│                        AEGIS CORE                       │
├──────────────────────┬──────────────────────────────────┤
│  📡 Real-Time        │  Monitor weather, AQI, city       │
│     Risk Monitoring  │  alerts, and infrastructure data  │
├──────────────────────┼──────────────────────────────────┤
│  🤖 AI Risk Engine   │  Predict disruption probability   │
│                      │  and score each zone (0–1)        │
├──────────────────────┼──────────────────────────────────┤
│  ⚡ Auto Claim       │  Trigger payouts automatically    │
│     Triggering       │  when thresholds are crossed      │
├──────────────────────┼──────────────────────────────────┤
│  💰 Weekly Micro     │  Affordable ₹25–₹79/week plans   │
│     Insurance        │  designed for gig income cycles   │
├──────────────────────┼──────────────────────────────────┤
│  🗣️ Voice AI         │  Multilingual assistant for       │
│     Assistant        │  worker queries and guidance      │
├──────────────────────┼──────────────────────────────────┤
│  🏛️ Gov Scheme       │  Auto-discover eligible           │
│     Discovery        │  government welfare programs      │
└──────────────────────┴──────────────────────────────────┘
```

**The key principle:** AEGIS uses *parametric insurance* — meaning payouts are triggered by **objective, measurable external conditions**, not subjective damage assessments. No manual claims. No verification delays.

---

## 👤 Target Persona

### Meet Arjun — Delivery Rider, Chennai

| Detail | Info |
|---|---|
| **Age** | 27 |
| **Occupation** | Food Delivery Rider |
| **City** | Chennai |
| **Work Schedule** | 6 days/week, 8–10 hours/day |
| **Average Daily Income** | ₹800 |
| **Transport** | Motorbike |

**Arjun's Challenges:**
- 🌧️ Heavy monsoon rain frequently stops deliveries entirely
- 🌡️ Extreme summer heat reduces the hours he can safely work
- 🚧 Local hartals and strikes shut down entire delivery zones
- 📉 Income drops to ₹0 on disrupted days — with no safety net

**The AEGIS Scenario:**

> Heavy rainfall hits Chennai. Flooding spreads across Arjun's delivery zone. Restaurants temporarily close. Delivery apps stop assigning orders. Arjun loses a full day of work — ₹800 gone.
>
> **AEGIS detects the rainfall event automatically. The AI engine confirms a disruption. Arjun receives his daily income protection payout without filing a single form.**

---

## ⚙️ How It Works

AEGIS operates through a 4-step automated workflow:

```
  ┌─────────────────────────────────────────────────────────────┐
  │                                                             │
  │   STEP 1            STEP 2            STEP 3     STEP 4    │
  │                                                             │
  │  Worker          Risk              Disruption   Auto       │
  │  Registration ──► Monitoring ─────► Detection ─► Payout   │
  │                                                             │
  └─────────────────────────────────────────────────────────────┘
```

### 🟦 Step 1 — Worker Registration

The worker registers on the AEGIS platform by providing:
- Full name and phone number
- City and delivery zone
- Weekly income protection plan selection

Registration takes under 2 minutes.

---

### 🟦 Step 2 — Continuous Risk Monitoring

AEGIS continuously ingests and monitors data from multiple live sources:

| Signal | Data Source |
|---|---|
| Rainfall levels | OpenWeather API |
| Temperature | OpenWeather API |
| Air Quality Index | Air Quality API |
| Civil disruptions | News feeds + Government alerts |
| Infrastructure events | Traffic and civic data APIs |

All signals are fed into the **AI Risk Engine** in real time.

---

### 🟦 Step 3 — Disruption Detection

The AI Risk Engine evaluates incoming signals against predefined thresholds:

```python
# Example Trigger Conditions
if rainfall_mm > 30:
    trigger_disruption_event()

if temperature_celsius > 42:
    trigger_disruption_event()

if aqi_index > 300:
    trigger_disruption_event()

if ai_risk_score > 0.8:
    escalate_to_disruption()

if city_alert contains ["curfew", "strike", "shutdown"]:
    trigger_disruption_event()
```

When conditions are met, a **Disruption Event** is declared for the affected zone.

---

### 🟦 Step 4 — Automatic Claim Trigger

Once a Disruption Event is confirmed:

1. 📍 Worker's registered zone is identified
2. 📋 Active plan coverage is verified
3. 💵 Daily payout amount is calculated
4. ✅ Compensation is credited automatically

> **Zero manual action required from the worker.**

---

## 💰 Insurance Plans

AEGIS uses a **weekly micro-insurance model** aligned with the short earning cycles of gig workers. Premium payments are small, predictable, and affordable.

| Plan | Weekly Premium | Daily Income Cover | Weekly Max Payout |
|---|---|---|---|
| 🟢 **Starter** | ₹25/week | ₹400/day | ₹2,000/week |
| 🔵 **Pro** | ₹49/week | ₹700/day | ₹3,500/week |
| 🟣 **Elite** | ₹79/week | ₹1,000/day | ₹5,000/week |

### 📊 Payout Example

```
Worker Daily Income    : ₹800
Selected Plan          : Pro (₹49/week)
Disrupted Days         : 3 days (rain event)
Daily Cover            : ₹700

Payout Calculation     : 3 × ₹700 = ₹2,100
Weekly Limit           : ₹3,500 ✅ Within limit

Final Payout           : ₹2,100 credited automatically
```

---

## ⚡ Parametric Trigger Model

AEGIS is built on **parametric insurance principles** — payouts are linked to objective, independently verifiable external events, not subjective damage assessments.

### 🌦️ Environmental Triggers

| Trigger | Condition |
|---|---|
| Heavy Rain | Rainfall > 30 mm in the worker's zone |
| Flooding | Flood severity alerts issued for the area |
| Extreme Heat | Temperature > 42°C |
| Severe Air Pollution | AQI > 300 (Hazardous level) |

### 🚧 Social / Civil Triggers

| Trigger | Condition |
|---|---|
| Local Strike | City alert includes "hartal" or "bandh" |
| Curfew | Official curfew declared in the zone |
| Zone Closure | Delivery zone officially closed |

### 🏗️ Infrastructure Triggers

| Trigger | Condition |
|---|---|
| Traffic Gridlock | Congestion index exceeds threshold |
| Metro Shutdown | Public transport disruption alerts |
| Power Outage | Sustained outage affecting the work zone |

> **Why Parametric?** Traditional insurance requires filing a claim, submitting proof, and waiting for an assessor — a process that fails gig workers entirely. Parametric triggers remove all of that friction.

---

## 🤖 AI & ML Integration

Artificial intelligence is at the core of every AEGIS decision layer.

### 1. Risk Prediction Engine

The AI model continuously analyzes incoming data and produces a **real-time risk score** between 0 and 1 for each worker zone.

**Inputs:**
- Rainfall forecasts (current + 24hr ahead)
- Temperature and humidity trends
- Historical weather disruption patterns
- City-specific seasonal risk data

**Output:**

```
Risk Score Range : 0.0 – 1.0
0.0 – 0.4       : Low Risk
0.4 – 0.7       : Moderate Risk
0.7 – 0.8       : High Risk
0.8 – 1.0       : Critical → Auto Trigger Payout
```

---

### 2. Dynamic Plan Recommendation

At registration and at plan renewal, AI recommends the most suitable plan based on:
- Worker's city and delivery zone
- Current season and historical disruption frequency
- Upcoming weather forecasts

*Example:* A worker in Mumbai enrolling during June (onset of monsoon) → **Elite Plan recommended**.

---

### 3. Fraud Detection

The AI engine continuously monitors claim patterns to detect anomalies:

| Anomaly Type | Detection Method |
|---|---|
| Abnormal claim frequency | Statistical outlier detection |
| Geographic inconsistencies | GPS zone cross-referencing |
| Repeated zone manipulation | Pattern analysis over time |

---

### 4. Voice AI Assistant

Workers can interact with AEGIS via a **natural language voice interface**, supporting regional languages.

**Example queries handled:**
> *"What happens if rain stops my work?"*
> *"Which plan should I choose this month?"*
> *"Was a disruption event declared in my area today?"*
> *"How much payout will I receive?"*

---

## 🗺️ Seasonal Risk Recommendation

AEGIS tailors insurance recommendations to India's regional climate patterns, ensuring workers are not over-insured or under-insured at any time of year.

| Region | Climate Pattern | Recommended Plan |
|---|---|---|
| **North India** | Monsoon concentrated June–September; dry otherwise | Starter (dry season) → Elite (monsoon) |
| **South India** | Dual monsoon (SW + NE); year-round risk | Pro or Elite year-round |
| **Coastal Regions** | High cyclone and flood risk | Elite Plan |
| **Arid Zones** | Extreme heat risk; low rain | Starter with heat triggers |

---

## 🛠️ Technology Stack

```
┌─────────────────────────────────────────────────────────────┐
│                     TECHNOLOGY STACK                        │
├───────────────────┬─────────────────────────────────────────┤
│ Frontend          │ React.js · Tailwind CSS · Vite          │
├───────────────────┼─────────────────────────────────────────┤
│ Backend           │ Node.js · Express.js                    │
├───────────────────┼─────────────────────────────────────────┤
│ Database          │ PostgreSQL                              │
├───────────────────┼─────────────────────────────────────────┤
│ AI / ML           │ Google Gemini API                       │
├───────────────────┼─────────────────────────────────────────┤
│ Weather Data      │ OpenWeather API                         │
├───────────────────┼─────────────────────────────────────────┤
│ Air Quality       │ Air Quality Index API                   │
├───────────────────┼─────────────────────────────────────────┤
│ Gov Schemes       │ Government Welfare Scheme APIs          │
├───────────────────┼─────────────────────────────────────────┤
│ Mapping           │ Leaflet.js                              │
├───────────────────┼─────────────────────────────────────────┤
│ Data Visualization│ Recharts                                │
└───────────────────┴─────────────────────────────────────────┘
```

---

## 🏗️ System Architecture

```
                        ┌─────────────────────┐
                        │    Worker / User     │
                        │   (Web App / Voice)  │
                        └──────────┬──────────┘
                                   │
                        ┌──────────▼──────────┐
                        │    React Frontend    │
                        │  (Worker Dashboard)  │
                        └──────────┬──────────┘
                                   │ REST API
                        ┌──────────▼──────────┐
                        │   Express.js Backend │
                        │  (Routes & Business  │
                        │      Logic)          │
                        └─────┬──────────┬────┘
                              │          │
               ┌──────────────▼──┐   ┌──▼──────────────┐
               │   PostgreSQL DB  │   │   AI Service     │
               │  (Workers, Plans,│   │ (Gemini API +    │
               │   Claims, Zones) │   │  Risk Engine)    │
               └─────────────────┘   └──────┬───────────┘
                                            │
                        ┌───────────────────▼──────────────────┐
                        │          External APIs                │
                        │  OpenWeather · AQI · Gov Schemes ·   │
                        │       Traffic · City Alerts           │
                        └──────────────────────────────────────┘
```

---

## 📁 Repository Structure

```
aegis/
│
├── frontend/
│   ├── worker-app/            # Gig worker-facing dashboard
│   │   ├── src/
│   │   │   ├── components/    # UI components
│   │   │   ├── pages/         # Route-level views
│   │   │   └── hooks/         # Custom React hooks
│   │   └── package.json
│   │
│   └── admin-dashboard/       # Admin monitoring panel
│       ├── src/
│       └── package.json
│
├── backend/
│   ├── routes/                # API route handlers
│   │   ├── workers.js
│   │   ├── claims.js
│   │   └── plans.js
│   ├── models/                # Database models
│   ├── middleware/            # Auth, error handling
│   └── server.js
│
├── ai-service/
│   ├── risk-prediction/       # AI risk scoring engine
│   │   ├── model.py
│   │   └── triggers.py
│   └── voice-assistant/       # Voice AI integration
│
├── docs/
│   ├── idea-document.md       # Full product specification
│   ├── api-reference.md       # API documentation
│   └── architecture.md        # System design diagrams
│
├── .env.example               # Environment variable template
├── docker-compose.yml         # Local dev environment
└── README.md
```

---

## 🗓️ Development Roadmap

```
  Phase 1 ──────────────── Phase 2 ──────────────── Phase 3 ──────────── Phase 4
  Ideation & Foundation    Prototype Dev             Advanced Features    Final Demo
  ──────────────────────   ──────────────────────    ─────────────────    ──────────
  ✅ Research gig worker   ○ Build worker dashboard   ○ Voice AI assistant  ○ Full integration
     problems              ○ Implement insurance      ○ Gov scheme          ○ Live disruption
  ✅ Design architecture      plans                      discovery              simulation
  ✅ Define insurance       ○ Integrate weather data  ○ Seasonal risk       ○ UX polish
     model                 ○ Develop AI risk engine      recommendation     ○ Hackathon demo
  ✅ Disruption detection   ○ Claims automation        ○ Disruption map
  ✅ Idea document          ○ Database schema          ○ Fraud detection
  ✅ Git repository
```

| Phase | Timeline | Status |
|---|---|---|
| Phase 1 – Ideation & Foundation | Week 1 | ✅ Complete |
| Phase 2 – Prototype Development | Week 2–3 | 🔄 In Progress |
| Phase 3 – Advanced Features | Week 3–4 | ⏳ Upcoming |
| Phase 4 – Final Demo | Week 5 | ⏳ Upcoming |

---

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed:
- [Node.js](https://nodejs.org/) v18+
- [PostgreSQL](https://www.postgresql.org/) v14+
- [Python](https://www.python.org/) 3.10+ (for AI service)
- [Git](https://git-scm.com/)

---

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/aegis.git
cd aegis
```

### 2. Configure Environment Variables

```bash
cp .env.example .env
```

Open `.env` and fill in the following:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/aegis

# AI
GEMINI_API_KEY=your_gemini_api_key

# Weather
OPENWEATHER_API_KEY=your_openweather_api_key

# Air Quality
AQI_API_KEY=your_aqi_api_key

# App
PORT=5000
NODE_ENV=development
```

### 3. Install Backend Dependencies

```bash
cd backend
npm install
npm run dev
```

### 4. Install Frontend Dependencies

```bash
cd ../frontend/worker-app
npm install
npm run dev
```

### 5. Set Up the Database

```bash
cd ../../backend
npm run db:migrate
npm run db:seed
```

### 6. Start the AI Service

```bash
cd ../ai-service
pip install -r requirements.txt
python risk-prediction/model.py
```

The app will be available at `http://localhost:5173`

---

## 🎬 Demo

> 📹 **2-Minute Demo Video:** [Insert Video Link Here]

The demo walkthrough covers:
- Worker registration and plan selection
- Live disruption monitoring dashboard
- AI risk score visualization
- Automatic payout trigger simulation
- Voice assistant interaction

---

## 📈 Expected Impact

AEGIS is designed to create measurable, lasting change for gig workers across India and beyond:

| Impact Area | Goal |
|---|---|
| 💵 Financial Stability | Protect daily income from unpredictable disruptions |
| 🧘 Reduced Anxiety | Eliminate financial uncertainty for day-to-day work |
| ⚡ Speed of Relief | Payouts credited same-day, no waiting period |
| 🌍 Scale | Deployable across any city with weather + civic data |
| 🏛️ Policy Bridge | Connect workers to government welfare schemes they miss |

> *AEGIS aims to be the financial immune system for the gig economy — invisible when things are fine, activated the moment a threat appears.*

---

## 🤝 Contributing

We welcome contributions from developers, designers, and researchers.

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Commit your changes: `git commit -m 'Add: your feature description'`
4. Push to the branch: `git push origin feature/your-feature-name`
5. Open a Pull Request

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

---

## 📄 License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for full details.

---

## 👥 Team

AEGIS is built by a team on a mission to make financial protection accessible to every gig worker.

> *"We didn't build AEGIS because insurance is broken. We built it because the people who need it most have always been left out of it."*

---

<div align="center">

**AEGIS** — Protecting income. Empowering workers. Powered by AI.

<br/>

[![Made with ❤️](https://img.shields.io/badge/Made%20with-❤️-red?style=for-the-badge)](.)
[![Built for Gig Workers](https://img.shields.io/badge/Built%20for-Gig%20Workers-orange?style=for-the-badge)](.)
[![AI Powered](https://img.shields.io/badge/AI-Powered-blueviolet?style=for-the-badge)](.)

</div>
