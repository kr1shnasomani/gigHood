<div align="center">
  <img src="./frontend/public/logo.jpeg" alt="gigHood logo" width="120" />
</div>

<table align="center">
<tr>
<td align="center">
<img src="https://github.com/user-attachments/assets/e2710db6-0137-4137-931f-adbdcdd13e15" width="420"/>
</td>
<td align="center">
<img src="https://github.com/user-attachments/assets/93d89b74-910b-4f0a-b47f-9b99ad389bdc" width="180"/>
</td>
</tr>
</table>
<div align="center">
<img src="https://readme-typing-svg.demolab.com?font=Syne&weight=700&size=18&pause=1200&color=38BDF8&center=true&vCenter=true&width=700&lines=Predict+disruptions+before+they+strike.;Automate+insurance.+Eliminate+paperwork.;Instant+payouts+when+gig+workers+need+it+most.;Built+for+India's+15M%2B+delivery+partners." alt="Typing SVG"/>

<br/>

![Zepto](https://img.shields.io/badge/Zepto-9B59B6?style=flat-square&logoColor=white)
![Blinkit](https://img.shields.io/badge/Blinkit-F7D000?style=flat-square&logoColor=black)

</div>

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/colored.png" width="100%">

<div align="center">

# gigHood

### AI-Powered Parametric Income Insurance for Gig Workers

<div align="center">

### 🎥 [Phase Two Pitch Video](https://youtu.be/xDvoUhNjD60)

<a href="https://youtu.be/xDvoUhNjD60">
<img width="450" height="320" alt="image" src="https://github.com/user-attachments/assets/1a02c217-c99c-4f12-808d-6ca1444abf7f" />
</a>

</div>

---

</div>

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/colored.png" width="100%">

<a name="table-of-contents"></a>

## 📚 Table of Contents

<details open>
<summary><b>📌 Overview</b></summary>

- [📌 TL;DR](#-tldr)
- [📊 The Reality in Numbers](#-the-reality-in-numbers)

</details>

<details open>
<summary><b>🔍 Problem</b></summary>

- [🔍 Problem Overview](#-problem-overview)
- [🧱 Barriers Gig Workers Face](#-barriers-gig-workers-face)
- [⚡ Disruption Types](#disruption-types)
- [🧠 Why Q-Commerce Workers, Specifically](#-why-q-commerce-workers-specifically)

</details>

<details>
<summary><b>🛡️ Solution & Architecture</b></summary>

- [🚀 Proposed Solution — gigHood](#-proposed-solution--gighood)
- [🆚 Why gigHood is Different](#-why-gighood-is-different)
- [01 · Spatial Risk Intelligence (DCI Engine)](#01--spatial-risk-intelligence-dci-engine)
- [02 · Weekly Micro-Insurance (Stable Pricing)](#02--weekly-micro-insurance-stable-pricing)
- [03 · Automated Claim Triggering & Instant Payouts](#03--automated-claim-triggering--instant-payouts)
- [04 · Worker-Centric Smart Application](#04--worker-centric-smart-application)
- [05 · Smart Protection Mode](#05--smart-protection-mode)
- [06 · AI Chatbot Assistant](#06--ai-chatbot-assistant)
- [🏗️ System Architecture](#️-system-architecture)

</details>

<details>
<summary><b>⚙️ Core System Design</b></summary>

- [🧮 The Demand Collapse Index](#-the-demand-collapse-index--our-core-intelligence)
- [🎯 Parametric Triggers](#-parametric-triggers)
- [💰 Weekly Pricing Model](#-weekly-pricing-model)
- [⚡ Zero-Touch Claims Automation](#-zero-touch-claims-automation)
- [🔍 Fraud Detection — Proof of Presence](#-fraud-detection--time-decay-proof-of-presence)
- [🛡️ Adversarial Defense & Anti-Spoofing Strategy](#️-adversarial-defense--anti-spoofing-strategy)
- [🔔 Proactive Coverage Alerts](#-proactive-coverage-alerts)

</details>

<details>
<summary><b>👤 Persona & Use Case</b></summary>

- [👤 Persona & Scenario](#-persona--scenario)
- [🎯 Why This Persona Matters](#-why-this-persona-matters)
- [📐 Parametric Insurance Model](#-parametric-insurance-model)
- [🤖 AI / ML Integration](#-ai--ml-integration)

</details>

<details>
<summary><b>📱 Product & Execution</b></summary>

- [📱 Application Workflow](#-application-workflow)
- [🏗️ Tech Stack & Architecture](#️-tech-stack--architecture)
- [🗓️ Development Plan](#️-development-plan)

</details>

<details>
<summary><b>📊 Business & Team</b></summary>

- [📊 Analytics Dashboard](#-analytics-dashboard)
- [📈 Business Viability](#-business-viability)
- [✅ Compliance with Problem Statement Constraints](#-compliance-with-problem-statement-constraints)
- [🎯 MVP Demo Scope — Built vs Mocked](#-mvp-demo-scope--built-vs-mocked)
- [📏 Target Success Metrics](#-target-success-metrics)
- [👥 Team](#-team)

</details>

---

### 📌 TL;DR

**Problem:** India's Q-commerce delivery partners (Zepto, Blinkit) lose 20–30% of weekly income to external disruptions — with zero financial protection.

**Solution:** gigHood — an AI-powered parametric income insurance platform that detects zone-level economic collapse and pays workers automatically within 90 seconds.

**Core Innovation:** Demand Collapse Index (DCI) — a spatial ML model that proves *income loss*, not just weather events, eliminating basis risk.

**What makes it different:** Zero-touch claims · H3 hex-grid fraud prevention · Weekly pricing aligned to gig earnings cycles · No paperwork ever.

### 🔬 ML Integrity Notes (Runtime)

1. DCI coefficients ($\alpha,\beta,\gamma,\delta$) are no longer static runtime constants; active values are loaded from `dci_weights` and refreshed through weekly retraining.
2. Fraud decisions use a hybrid of explainable rules and model probability (XGBoost), so outputs remain auditable while incorporating learned patterns.
3. Weekly scheduler pipeline now retrains risk tiering, fraud scoring, and DCI weight optimization as one closed-loop cycle.

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/colored.png" width="100%">

## 📊 The Reality in Numbers

### 📉 Income Loss

| Stat | Source |
|:-----|:-------|
| Gig workers lose **20–30%** of monthly income during disruptions | DEVTrails 2026 Problem Statement |
| Q-commerce order fulfilment drops **60–80%** during heavy rain (>30mm/hr) vs 20–35% for food delivery | RedSeer Consulting, Q-commerce Ops Report 2023 |
| Disruptions occur **3–6 times/month** per dark store zone in monsoon-affected cities | RedSeer Consulting, 2023 |

### 👷 Worker Reality

| Stat | Source |
|:-----|:-------|
| India's gig workforce: **15M+** delivery partners | NITI Aayog, India's Booming Gig Economy 2022 |
| Q-commerce workers report **zero financial buffer** for disruption days | IFMR LEAD gig worker field research, 2022–2024 |
| **No income protection product** currently exists for parametric income loss in this segment | ICRIER Gig Economy Report, 2023 |

<div align="right"><a href="#table-of-contents">⬆ Back to Top</a></div>

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/colored.png" width="100%">

## 🔍 Problem Overview

<div align="center">

<img src="https://readme-typing-svg.demolab.com?font=Syne&weight=700&size=20&pause=1000&color=38BDF8&center=true&vCenter=true&width=700&lines=India's+gig+workers+deliver+everything...;...except+financial+safety.;Millions+work+without+a+safety+net.;One+disruption.+Zero+income." alt="Typing SVG"/>

</div>

<br/>


India's gig economy is the invisible engine behind on-demand urban life. Millions of delivery partners working with **Zepto**, **Blinkit**, **Swiggy Instamart**, and other quick-commerce platforms ensure fast, reliable fulfillment — yet they operate entirely **without a stable financial safety net**.

Unlike salaried employees, gig workers are compensated **strictly per delivery or per hour worked.** When the environment turns hostile — weather, pollution, civil unrest — they simply **stop earning.**

<div>

<h3>📉 Income Impact on Delivery Partners</h3>

<p>
External disruptions like heavy rain, pollution, and curfews can reduce a delivery partner's earnings by
<b style="font-size:22px;color:#ff6b6b;">20–30%</b> of their monthly income.
</p>


Normal Earnings  
████████████████████ 100%

During Disruptions  
██████████████░░░░░░ 70–80%

<i>Studies and platform reports consistently confirm this trend across major Indian cities.</i>

</div>
<img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=db8947&section=footer" width="100%"/>


## 🧱 Barriers Gig Workers Face

A structural analysis of the compounding vulnerabilities that leave delivery partners financially exposed during operational disruptions.

### 👷 Worker-Level Barriers

| # | Issue |
|:--|:------|
| 01 | No compensation during forced work stoppages |
| 02 | Daily-earning dependency — **zero financial buffer** |
| 03 | Forced to choose between **safety** and **survival** |
| 04 | No short-term income loss insurance product exists |
| 05 | Even a few-hour disruption causes immediate strain |

### 🏗️ Systemic Barriers

| # | Issue |
|:--|:------|
| 01 | Traditional insurance is **slow, complex, dispute-prone** |
| 02 | No product aligned to **weekly earning cycles** |
| 03 | Fraudulent claims risk without smart verification |
| 04 | No dynamic pricing based on real-time risk |
| 05 | No automated disruption detection pipeline |
<img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=db8947&section=footer" width="100%"/>


## 🌩️ Disruption Types
gigHood identifies and responds to **two primary classes of disruptions** that halt delivery operations and eliminate gig worker income:

### 🌧️ Environmental Disruptions

| Disruption | Mechanism | Impact |
|:-----------|:----------|:-------|
| 🌧️ &nbsp;Extreme rainfall & flooding | Roads become impassable | Delivery routes blocked entirely |
| 🌡️ &nbsp;Severe heatwaves | Outdoor temps exceed safety thresholds | Platform suspends operations |
| 🌫️ &nbsp;Hazardous AQI spikes | Air quality crosses danger limits | Workers stop to avoid health risk |
| 🌀 &nbsp;Cyclones & storms | High-wind unsafe for two-wheelers | All outdoor operations halted |
| 🚧 &nbsp;Waterlogged routes | Key corridors flooded | GPS routes unusable |

<br/>

### 🚦 Social & Administrative Disruptions

| Disruption | Mechanism | Impact |
|:-----------|:----------|:-------|
| 🚫 &nbsp;Government-imposed curfews | Movement legally restricted | Zero pickups or drop-offs possible |
| ✊ &nbsp;Local strikes & bandhs | Coordinated shutdowns | Vendor hubs and drop points closed |
| 📣 &nbsp;Political protests | Blocked roads, unsafe conditions | Routing impossible in affected zones |
| 🏪 &nbsp;Sudden market closures | Vendor hubs shut without notice | Fulfillment chain broken |
| 🛑 &nbsp;Mobility restriction orders | Vehicle bans in key areas | Last-mile delivery impossible |

<img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=db8947&section=footer" width="100%"/>


### 📋 How Every Disruption Leads to the Same Outcome

```
+------------------------------------------------------------------------+
|                                                                        |
|  Heavy Rain  ->  Roads unsafe        ->  Deliveries halted   ->  Rs.0  |
|  High AQI    ->  Outdoor work risky  ->  Platform suspends   ->  Rs.0  |
|  Heatwave    ->  Safety hazard       ->  Operations paused   ->  Rs.0  |
|  Curfew      ->  Movement blocked    ->  No pickups/drops    ->  Rs.0  |
|  Bandh       ->  Hubs closed         ->  No fulfillment      ->  Rs.0  |
|                                                                        |
|    Every disruption type  ->  Same outcome for gig workers             |
|               ZERO earnings.    ZERO protection.                       |
|                                                                        |
+------------------------------------------------------------------------+
```

<img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=db8947&section=footer" width="100%"/>


<table>
<tr>

<td width="65%" valign="top">
  
## 🧠 Why Q-Commerce Workers, Specifically


The choice of Q-commerce over food delivery or e-commerce is a deliberate design decision, not a label. Three structural properties make this persona the strongest fit for parametric insurance:

**Fixed zone dependency.** Every Zepto or Blinkit partner is geo-fenced to a dark store's delivery radius — typically 1–1.5 km. This radius maps almost exactly to Uber's H3 spatial index at resolution 9 (~1.2 km hexagons). This means our spatial risk model is not an approximation; it is architecturally aligned with how the workers actually earn.

**Predictable disruption correlation.** Q-commerce orders are highly weather-elastic. A 35mm/hr rainfall event does not slow deliveries — it stops them entirely, because two-wheelers cannot safely navigate flooded lanes at speed within a 10-minute SLA. The income-disruption relationship is measurable and consistent, which makes parametric triggers reliable rather than approximate.

**High disruption frequency, low per-event loss.** Unlike a hurricane (catastrophic, rare), Q-commerce workers face moderate disruptions 3–6 times per month in monsoon-affected cities. This frequency makes weekly micro-insurance financially natural and actuarially manageable.

</td>

<td width="35%" align="center">

<img src="https://github.com/user-attachments/assets/e68548fe-a13f-461a-8efb-ace894a2c922" width="320"/>

</td>

</tr>
</table>


<div align="center">

<img src="https://readme-typing-svg.demolab.com?font=Syne&weight=700&size=15&pause=2000&color=EF4444&center=true&vCenter=true&width=600&lines=This+is+the+problem+gigHood+solves.;Automated.+Instant.+AI-powered+protection." alt="CTA Typing SVG"/>

</div>

<div align="right"><a href="#table-of-contents">⬆ Back to Top</a></div>

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/colored.png" width="100%">

## 🚀 Proposed Solution — gigHood

<div align="center">

<img src="https://readme-typing-svg.demolab.com?font=Syne&weight=800&size=26&pause=1500&color=38BDF8&center=true&vCenter=true&width=700&lines=Introducing+gigHood;AI-Powered+Income+Protection;Predict.+Automate.+Protect.;Zero+paperwork.+Instant+payouts." />

</div>

<br/>

**gigHood** is an AI-powered parametric insurance platform designed specifically for **quick-commerce delivery partners** (Zepto, Blinkit, Instamart).

It transforms traditional insurance into a **real-time, predictive, and automated income protection system** — combining spatial intelligence, disruption detection, micro-insurance, and instant payouts.

Unlike traditional systems that rely on claims, gigHood detects when **earning opportunities in a delivery zone collapse** and compensates workers automatically.

<div align="center">

| ₹20 | 5+1 | 0 | Spatial AI | < 90s |
|:---:|:---:|:---:|:---:|:---:|
| Starting weekly premium | Primary layers + fraud intelligence | Manual claims needed | DCI-based intelligence | Trigger to payout |

</div>

<img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=db8947&section=footer" width="100%"/>

## 🆚 Why gigHood is Different

Most parametric insurance products ask: **"Is it raining?"** — and pay out if it is. gigHood asks: **"Has earning opportunity in this zone actually collapsed?"** — and pays only if it has. This distinction eliminates basis risk entirely.

| Dimension | Weather-Based Insurance | gigHood |
|:----------|:----------------------:|:-------:|
| Trigger | Single weather signal | Multi-signal Demand Collapse Index |
| Spatial precision | City-wide or district | H3 hex-grid — ~1.2km cells |
| Basis risk | High — rain can increase orders | Low — DCI proves income loss |
| Fraud prevention | Absent or basic | Time-Decay Proof-of-Presence engine |
| Claims process | Worker must file | Zero-touch — fully automated |
| Pricing model | Fixed or annual | Weekly, zone-adaptive, IRDAI Sandbox pathway |

<img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=db8947&section=footer" width="100%"/>

### 01 · Spatial Risk Intelligence (DCI Engine)

The core intelligence of gigHood is the **Demand Collapse Index (DCI)** — a spatial model that determines whether income in a delivery zone has collapsed.

Instead of asking *“Is it raining?”*, gigHood asks:

> **“Has earning opportunity in this zone stopped?”**

#### Data Inputs

| Signal | Purpose |
|:------|:--------|
| Weather (rainfall, wind) | Detect delivery-blocking conditions |
| Traffic congestion | Identify mobility breakdown |
| Platform status | Detect delivery outages |
| Social signals | Capture curfew / shutdown events |

#### DCI Formula

```
DCI_h  =  σ( α·W  +  β·T  +  γ·P  +  δ·S )

  W  =  Weather severity score   (rainfall mm/hr, wind speed, AQI)
  T  =  Traffic congestion index (0–1 normalized)
  P  =  Platform outage flag     (latency / order volume drop)
  S  =  Social disruption score  (curfew, strike, zone closure)

  σ(x)  =  1 / (1 + e^-x)       (sigmoid — maps to 0–1 probability)

  α = 0.45  β = 0.25  γ = 0.20  δ = 0.10   (cold-start priors)
```
#### Trigger Condition

If DCI > 0.85 → Zone is **economically disrupted**

→ Claims are triggered automatically

**Capabilities:**
- Hyperlocal disruption detection  
- Income collapse prediction  
- Zone-level risk scoring  

<img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=db8947&section=footer" width="100%"/>

### 02 · Weekly Micro-Insurance (Stable Pricing)

Policies are aligned with the **weekly earning cycle of Q-commerce workers**.

<div align="center">

| Tier | Weekly Premium | Coverage |
|:-----|:--------------:|:---------|
| 🟢 Tier A | ₹20/week | Low-risk zones |
| 🟡 Tier B | ₹30/week | Moderate-risk zones |
| 🔴 Tier C | ₹42/week | High-risk zones |

</div>

Premiums are based on:

→ **4-week rolling average of DCI**

This ensures:
- Stable pricing  
- No sudden spikes  
- Worker trust  

<img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=db8947&section=footer" width="100%"/>

### 03 · Automated Claim Triggering & Instant Payouts

gigHood eliminates manual claim processes entirely.

#### Trigger Conditions

- Rainfall ≥ 35mm/hr  
- AQI > 300  
- Traffic gridlock  
- Platform outage  
- DCI > 0.85  

#### Automated Flow

Disruption detected  
→ Workers in zone identified  
→ Proof-of-Presence validated  
→ Payout calculated  
→ UPI transfer executed (< 90s)  
→ Notification sent  

✅ Zero paperwork  
✅ No claim filing  
✅ Fully automated payouts  
<img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=db8947&section=footer" width="100%"/>

### 04 · Worker-Centric Smart Application


| Feature | Description |
|:--------|:------------|
| Zone Risk Dashboard | Real-time DCI-based disruption risk for worker’s hex zone |
| Safety Radar | H3 hex-based live map showing safe, risky, and disrupted zones |
| Policy Activation | Tier assignment with weekly UPI auto-debit |
| Payout History | Timeline of past disruptions, payouts, and earnings impact |
| Earnings Forecast | AI-based prediction of next-day and weekly income |
| Proactive Tier Alerts | Sunday risk forecast with optional tier upgrade |
| Financial Health Score | Worker stability index based on income consistency |
| AI Chat Assistant | Conversational assistant for policy, payouts, and risk queries |
| Voice AI Assistant | Multilingual voice support (Hindi, Tamil, etc.) |
| Govt Scheme Discovery | Personalized government welfare recommendations |

**User Flow:**

Login → Zone Risk → Plan Selection → Policy Activation → Auto Protection

<img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=db8947&section=footer" width="100%"/>

### 05 · Smart Protection Mode

gigHood continuously monitors **zone-level disruption risk**.

- DCI > 0.75 → Early warning  
- DCI > 0.85 → Auto payout trigger  

Workers stay protected without any manual intervention.

<img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=db8947&section=footer" width="100%"/>

### 06 · AI Chatbot Assistant

gigHood integrates a real-time AI Chat Assistant in Phase 3, making the platform accessible for workers with varying digital literacy.

> *"Workers don't navigate the system — they talk to it."*

The chatbot is powered by the OpenRouter/Groq API with the worker's policy context, current DCI score, and last payout injected into each session. It is **read-only and explanatory** — it never files claims or modifies policies.

| Capability | Description |
|:-----------|:------------|
| 🧠 Smart Q&A | Answers policy, payout, and risk queries instantly |
| 📊 Risk Explanation | Explains why DCI is high in plain language |
| 💰 Payout Breakdown | Shows exactly how payout was calculated |
| 🛡️ Policy Guidance | Explains tier differences and upgrade implications |
| 📢 Disruption Context | Conversational summary of active disruption events |

**Supported languages:** Hindi · Kannada · Tamil · Telugu · English

<img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=db8947&section=footer" width="100%"/>


## 🏗️ System Architecture

The platform is composed of five primary layers — signal ingestion, spatial intelligence, policy and pricing, claims automation, and payout and dashboard — with an integrated fraud intelligence layer embedded within the claims engine.

```mermaid
flowchart TD
    subgraph Signals["External Signal Layer"]
        W["Weather API<br>OpenWeatherMap"]
        AQI["AQI / Pollution<br>CPCB API"]
        TR["Traffic API<br>Google Maps Mock"]
        PL["Platform Status<br>Simulated API"]
        CU["Curfew / Social<br>Gov Alert Feed"]
    end

    subgraph Spatial["Spatial Intelligence Layer"]
        H3["H3 Hex Grid<br>Resolution 9 — ~1.2km cells"]
        DCI["Demand Collapse Index<br>Computed per hex every 5 min"]
    end

    subgraph Policy["Policy and Pricing Engine"]
        RP["Risk Profiler<br>XGBoost — zone + worker history"]
        PB["Weekly Premium Bander<br>4-week rolling average"]
        PM["Policy Manager<br>Creation, renewal, coverage status"]
    end

    subgraph Claims["Claims Automation Engine"]
        TM["Trigger Monitor<br>Real-time DCI threshold watch"]
        POP["Proof-of-Presence Validator<br>Time-decay fraud check"]
        CA["Claim Approver<br>Auto-approve or flag"]
    end

    subgraph Payout["Payout and Presentation Layer"]
        UPI["UPI Payout<br>Razorpay Sandbox"]
        WA["Worker Mobile App<br>React Native"]
        AD["Admin Dashboard<br>Next.js — live hex map"]
    end

    Signals --> H3
    H3 --> DCI
    DCI --> TM
    DCI --> RP
    RP --> PB
    PB --> PM
    TM --> POP
    POP --> CA
    CA --> UPI
    UPI --> WA
    CA --> AD
    PM --> WA
```

Each layer is independently deployable and testable. Signal ingestion uses free-tier APIs with mock fallbacks for demo purposes. The spatial layer runs on PostGIS with H3 extension. The claims engine is stateless and event-driven, with DCI recomputation scheduled via APScheduler running inside the FastAPI process.
<img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=db8947&section=footer" width="100%"/>

## 🧮 The Demand Collapse Index — Our Core Intelligence

The DCI is the mathematical heart of gigHood. It answers a single question: **has the local gig economy inside this hex actually stopped?**

We do not ask "is it raining?" — rain sometimes increases Q-commerce orders. We do not ask "is there a curfew?" — curfews sometimes affect only certain hours. We ask: given all observable signals simultaneously, has earning opportunity collapsed below a viable threshold?

### The Formula

$$DCI_h = \sigma\left(\alpha W_h + \beta T_h + \gamma P_h + \delta S_h\right)$$

Where $\sigma$ is the sigmoid function, mapping the raw score to a probability between 0 and 1:

$$\sigma(x) = \frac{1}{1 + e^{-x}}$$

| Variable | Description | Data Source |
|---|---|---|
| $W_h$ | Weather severity score for hex $h$ (rainfall mm/hr, wind speed, AQI) | OpenWeatherMap + CPCB |
| $T_h$ | Traffic congestion index (0–1, normalized) | Google Maps Traffic mock |
| $P_h$ | Platform delivery uptime / latency flag | Simulated platform status API |
| $S_h$ | Social disruption score (curfew, strike, zone closure) | Government alert feed mock |
| $\alpha, \beta, \gamma, \delta$ | ML-derived weights from historical disruption impact | XGBoost model (see cold-start below) |

<img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=db8947&section=footer" width="100%"/>


### Cold-Start Strategy

On Day 1, we have no historical claim data. We solve this with **actuarial priors bootstrapped from open data**:

- IMD (India Meteorological Department) historical rainfall records for the city, mapped to reported delivery downtime from Zepto/Blinkit public incident disclosures.
- IMD-correlated urban mobility datasets from open government data portals (data.gov.in) covering city-level flood impact on road accessibility and transit disruption.
- Expert heuristic priors with explicit justification:

```
α = 0.45  (weather — dominant signal)
          RedSeer 2023 confirms Q-commerce order fulfilment drops 60–80%
          during heavy rain, the strongest single correlation in the dataset.
          Weather is the most frequent and most impactful trigger for this persona.

β = 0.25  (traffic — secondary signal)
          Traffic gridlock directly blocks physical delivery routes.
          Correlated with weather but independently observable —
          curfews cause gridlock without rain, floods cause gridlock
          without formal traffic API signals.

γ = 0.20  (platform — tertiary signal)
          Platform outages are less frequent than weather events but
          cause near-total income loss when they occur. Lower weight
          because platform status is a binary flag, not a continuous scale.

δ = 0.10  (social — least weighted)
          Curfews and bandhs are the least frequent disruption type
          in monsoon-affected Tier-1 cities (typically < 1 per month
          vs 3–6 weather events per month, RedSeer 2023).
```

Weights are updated weekly via online XGBoost retraining as real DCI events and claim outcomes accumulate. The model converges on city-specific weights typically within 6–8 weeks of live operation.

<img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=db8947&section=footer" width="100%"/>


### Trigger Threshold

```
DCI_h > 0.85  →  Hex declared DISRUPTED
                  Automated claim processing begins for all active policyholders

0.65 < DCI_h ≤ 0.85  →  Elevated Watch — worker alerted, no payout yet

DCI_h ≤ 0.65  →  Normal operations — no action
```

The 0.85 threshold is not arbitrary. It is initialized based on the historical DCI distribution at which 90% of Q-commerce dark store operations in pilot cities were confirmed halted, cross-referenced against IMD rainfall event logs and Zepto public incident reports. The threshold is tunable per city via the admin dashboard and recalibrates automatically as claim outcomes accumulate — a disruption event where 95%+ of workers in a hex go offline is treated as ground truth for threshold refinement.

### XGBoost's Exact Role

It is important to be precise about what the ML model does and does not do. XGBoost performs two specific tasks: (1) **risk band classification** — assigning each worker to Tier A, B, or C using features including their zone's 12-week DCI history, seasonal weather patterns, proximity to flood-prone areas, and historical claim frequency; and (2) **DCI weight optimization** — updating the α, β, γ, δ coefficients weekly based on actual disruption outcomes. The DCI computation itself is a deterministic sigmoid over those weights — it is not a neural network and does not hallucinate outputs. This distinction matters for regulatory compliance and auditability.
<img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=db8947&section=footer" width="100%"/>

## 🎯 Parametric Triggers

To satisfy the requirement of 3–5 independent automated triggers, we expose the DCI's component signals as individual triggers *before* they fuse into the composite index. This gives judges a clear checklist while preserving the architectural elegance of the composite model.

```mermaid
flowchart LR
    subgraph Triggers["Independent Parametric Triggers"]
        T1["Trigger 1 — Weather<br>Rainfall ≥ 35mm/hr<br>OR wind ≥ 45km/hr"]
        T2["Trigger 2 — Air Quality<br>AQI > 300<br>Hazardous threshold"]
        T3["Trigger 3 — Traffic Shutdown<br>Congestion index = 1.0<br>Full gridlock"]
        T4["Trigger 4 — Platform Outage<br>Delivery app latency > 30s<br>OR order volume drop ≥ 70%"]
        T5["Trigger 5 — Social Disruption<br>Verified curfew<br>OR strike in delivery zone"]
    end

    T1 & T2 & T3 & T4 & T5 --> DCI["DCI Composite<br>σ(αW + βT + γP + δS)"]
    DCI -->|DCI > 0.85| CLAIM["Automated<br>Claim Initiated"]
    DCI -->|0.65 < DCI ≤ 0.85| WATCH["Elevated Watch<br>Worker Alerted"]
    DCI -->|DCI ≤ 0.65| NORMAL["Normal Operations<br>No Action"]
```

Each trigger is independently monitorable and logged. This means a weather-only event (trigger 1 fires, others do not) still flows through the DCI and may or may not cross the 0.85 threshold depending on contextual signals — preventing single-signal false positives while maintaining independent auditability.
<img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=db8947&section=footer" width="100%"/>

## 💰 Weekly Pricing Model

### Design Philosophy

Gig workers are extraordinarily price-sensitive. A premium that fluctuates week-to-week based on raw ML output creates distrust and churn. At the same time, a flat premium ignores real risk variation across zones and seasons. We resolve this tension with **Predictive Weekly Risk Bands** computed on a **4-week rolling average** of the hex's DCI history.

### Risk Band Structure

| Band | Weekly Premium | Typical DCI History | Coverage Cap |
|---|---|---|---|
| Tier A — Low Risk | ₹20/week | Rolling avg DCI < 0.40 | ₹600/day × active days |
| Tier B — Moderate Risk | ₹30/week | Rolling avg DCI 0.40–0.65 | ₹700/day × active days |
| Tier C — High Risk | ₹42/week | Rolling avg DCI > 0.65 | ₹800/day × active days |

Using a 4-week rolling average prevents two failure modes: **adverse selection** (premium doesn't spike when a worker is most vulnerable during a predicted cyclone week) and **regulatory concern** (premiums appear stable and predictable to workers and compliance reviewers).

### Pricing Computation Flow

```mermaid
flowchart TD
    A["Worker Onboards<br>Provides: city, dark store zone, avg daily earnings"]
    --> B["Zone History Query<br>4-week rolling DCI average for hex"]
    B --> SEA{Season?}
    SEA -->|"Monsoon — Jun to Sep"| MULT["Apply 1.4x seasonal multiplier<br>to base tier premium"]
    SEA -->|"Dry season — Oct to May"| NOMULT["Standard tier premium<br>no multiplier applied"]
    MULT --> C{Assign Risk Band}
    NOMULT --> C
    C -->|Avg DCI < 0.40| D["Tier A — ₹20/week<br>(₹28 monsoon)"]
    C -->|Avg DCI 0.40–0.65| E["Tier B — ₹30/week<br>(₹42 monsoon)"]
    C -->|Avg DCI > 0.65| F["Tier C — ₹42/week<br>(₹59 monsoon)"]
    D & E & F --> G["Policy Created<br>Weekly auto-debit activated"]
    G --> H["Weekly Premium Pool<br>Contributes to zone risk pool"]
    H --> I["Pool monitored by insurer<br>Target loss ratio: 60–70%"]
```


### Regional Risk Recommendations

| Region | Peak Risk Period | Primary Risk | Recommended Coverage |
|:-------|:----------------:|:------------:|:---------------------|
| Delhi | Oct – Feb | AQI spikes | AQI protection add-on |
| Mumbai | Jun – Sep | Monsoon + flooding | Flood coverage |
| Chennai | Nov – Dec | Cyclone + rain | Rain + cyclone bundle |
| Rajasthan | Apr – Jun | Extreme heat | Heatwave protection |
| Bengaluru | Jun – Sep | Monsoon disruption | Rain + traffic bundle |


### Proactive Tier Upgrade for Forecast Events

When the DCI forecast for the *next* week exceeds 0.75 (indicating elevated disruption probability), the worker receives a proactive alert on Sunday evening offering an **optional upgrade to the next higher tier for the coming week's premium cycle**:

> *"High disruption risk forecasted for your zone next week. Upgrade from Tier B to Tier C for next week — pay ₹42 instead of ₹30 and double your daily payout cap to ₹1,400. No action needed if you decline — your Tier B coverage continues."*

This is strictly a weekly pricing decision — the worker is choosing their tier for the next billing week, not purchasing a one-off daily add-on. This preserves the weekly pricing constraint while giving workers financial agency before a foreseeable disruption. The upgrade is voluntary, irreversible for that week once confirmed, and processed as a standard weekly premium payment through the same UPI auto-debit channel.


<img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=db8947&section=footer" width="100%"/>

## ⚡ Zero-Touch Claims Automation

The defining UX principle of gigHood is that **a worker should never need to file a claim**. The system detects, validates, and pays without requiring any worker action. For gig workers with low digital literacy and high stress during disruptions, this is not a feature — it is the product.

```mermaid
sequenceDiagram
    participant SIG as Signal APIs
    participant DCI as DCI Engine
    participant POP as PoP Validator
    participant CLM as Claims Engine
    participant PAY as Razorpay UPI
    participant WRK as Worker App

    SIG->>DCI: Raw signal data every 5 min
    DCI->>DCI: Compute DCI per active hex
    DCI-->>CLM: DCI_h = 0.91 (threshold crossed)

    CLM->>CLM: Identify all active policyholders in hex_h
    CLM->>POP: Validate presence for each worker
    POP->>POP: Check: was worker in hex BEFORE disruption onset?
    POP-->>CLM: 98 workers validated / 2 flagged as zone-hoppers

    CLM->>CLM: Calculate payout per worker (avg daily earnings × disrupted hours / 8)
    CLM->>PAY: Initiate 98 UPI payouts
    PAY-->>WRK: Push notification + UPI credit
    WRK-->>WRK: "₹480 credited — income protected"

    CLM->>CLM: Log claim event, update DCI model
```

### Income Loss Calculation

```
Payout  =  (Worker's Average Daily Earnings ÷ 8)  ×  Verified Disrupted Hours

  Verified Disrupted Hours  =  duration DCI_h remained above 0.85
  Daily Earnings declared at onboarding, cross-referenced vs zone 90th percentile
  Caps set at 85th percentile of earnings distribution:
    ₹600–₹800/day (based on IFMR LEAD gig worker field research and NITI Aayog 2022 data)
```

"Verified disrupted hours" is the duration the hex's DCI remained above 0.85. This prevents full-day payouts for a disruption that cleared in two hours.

Workers declare their average daily earnings at onboarding. This is cross-referenced against the zone's typical earning range to catch inflated declarations — a simple but effective fraud gate at the policy creation stage. Payout caps of ₹600–₹800/day are anchored to real worker earnings data: Q-commerce delivery partners in Tier-1 Indian cities report average daily earnings of ₹520–₹680, with top-decile earners reaching ₹800–₹900 on peak days (IFMR LEAD Gig Worker Income Survey, 2024). The caps are set at the 85th percentile of that distribution, ensuring legitimate high earners are covered without inflating the average claim size.

### Signal API Fallback — Degraded Mode

If fewer than 3 of 5 signal sources are available at computation time (e.g., a traffic API outage or a government feed delay), the DCI computation is paused for that hex and the system enters **degraded monitoring mode**. Workers in the affected hex receive a push notification: *"gigHood is monitoring your zone with reduced signal coverage. Coverage remains active. We will notify you when full monitoring resumes."* Claims are not auto-denied during degraded mode — they are queued for manual review with a 2-hour SLA. This prevents false denials caused by infrastructure failures rather than genuine absence of disruption.


<img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=db8947&section=footer" width="100%"/>

## 🔍 Fraud Detection — Time-Decay Proof of Presence

Parametric insurance has one dominant fraud vector: **zone hopping** — a worker who is not in the disrupted area drives into it after the trigger fires to collect a payout. The Time-Decay Proof of Presence (PoP) engine eliminates this with minimal computational overhead and no battery-intensive tracking.

### How It Works

The gigHood mobile app sends an **encrypted H3 hex ping every 15 minutes** while the app is in foreground or background. These pings are stored as a lightweight timestamped log:

```
{ worker_id: "w_4821", hex_id: "8928308280fffff", timestamp: "2026-03-14T08:15:00Z" }
```

Background ping reliability is handled explicitly: on Android, pings are dispatched via **WorkManager** with a flex interval, which survives Doze mode and battery optimisation. On iOS, pings use the **BackgroundTasks framework** (BGAppRefreshTask). Since Q-commerce workers already grant persistent foreground location permission to their Zepto/Blinkit delivery apps, the OS treats gigHood as a co-active location service rather than a background-only app, significantly reducing the kill probability. As a fallback, if fewer than 3 pings exist in the 90-minute pre-disruption window, the system defers to the delivery platform's GPS log (retrieved via mock platform API in the demo; via data partnership in production) before making a zone-hop determination.

When a disruption triggers, the PoP engine performs a single historical lookup:

```mermaid
flowchart TD
    A["Disruption trigger fires<br>for hex H at time T"]
    --> B["Retrieve worker's location log<br>for window T-90min to T"]
    B --> C{"Was worker in hex H<br>within 90 min before T?"}
    C -->|"Yes — at least one ping"| D["Presence confirmed<br>Claim proceeds to approval"]
    C -->|"No pings in hex H"| E["Check platform GPS fallback<br>via mock platform API"]
    E --> EE{"GPS fallback<br>confirms presence?"}
    EE -->|Yes| D
    EE -->|No| DENY["Zone-hop detected<br>Claim auto-denied<br>Worker notified"]
    D --> F{"Secondary check:<br>Duplicate claim within 24hrs?"}
    F -->|No| G[Claim Approved]
    F -->|Yes| H["Flagged for manual review<br>Anti-duplicate gate"]
```
<img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=db8947&section=footer" width="100%"/>


### Additional Fraud Gates

Beyond zone-hopping, gigHood applies three secondary checks at the claim processing stage:

**Earnings inflation detection.** Declared daily earnings are compared against the zone's 90th percentile. Declarations above the 90th percentile trigger a soft flag and require secondary validation before payout (not auto-denial — gig workers at peak performance genuinely earn more).

**Claim frequency anomaly.** A worker claiming payouts on more than 60% of their active days over a rolling 4-week period is flagged for review. This catches workers who are gaming the DCI threshold by operating in high-risk zones deliberately.

<div align="right"><a href="#table-of-contents">⬆ Back to Top</a></div>


**Coordinated claim clustering.** If 100% of policyholders in a hex claim on the same event, this is expected and correct. If only a suspiciously small subset claims (e.g., 3 out of 80 active workers), the 3 outliers are flagged — real disruptions affect all workers in a zone, not a precise subset.
<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/colored.png" width="100%">

## 🛡️ Adversarial Defense & Anti-Spoofing Strategy

<div align="center">

<img src="https://readme-typing-svg.demolab.com?font=Syne&weight=700&size=16&pause=1500&color=EF4444&center=true&vCenter=true&width=700&lines=500+real+workers.+Telegram+group.+GPS+spoofers.+Liquidity+drained.;gigHood+verifies+order+activity%2C+not+GPS+coordinates." alt="Adversarial Defense SVG"/>

</div>

> **Core Principle: "gigHood verifies order activity — not GPS coordinates."**
>
> The Market Crash scenario is 500 **real registered gig workers** — not bots — who read the same IMD weather forecast, pre-position their spoofed GPS 3 hours before the storm, spread across 25 hexes at 20 per hex, activate manually over a 30-minute window, and have 6 months of legitimate history. They can keep their GPS spoofing app running all day on a plugged-in device. They can set themselves as "Available" on the Zepto rider app from their couch. Every naive GPS check, density threshold, and sync detector fails against them. gigHood's defense is built for exactly this attacker profile.

<img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=EF4444&section=footer" width="100%"/>

### 🔒 Layer 0 — The DCI Anchor (Why the Attack Requires a Real Storm)

The structural guarantee that prevents synthetic fraud events. No worker can trigger a payout without a genuine infrastructure-level disruption.

```
DCI inputs — all external, none from worker devices:
  W  →  OpenWeatherMap rainfall API         (weather station)
  T  →  Traffic congestion index            (road sensor data)
  P  →  Platform delivery uptime            (server-side API)
  S  →  Government curfew / alert feed      (official feed)
```

A GPS spoof into a hex where `DCI = 0.30` triggers nothing. The pool cannot be drained without a real storm. The Market Crash confirms this — the syndicate waited for a genuine red-alert event. Layer 0 is architecturally unbypassable. Every layer below handles the harder problem: 500 fraudsters riding a real disruption they did not manufacture.

> **To manufacture a false DCI spike, an attacker would need to fake a rainstorm, a traffic shutdown, and a government alert simultaneously. That is not fraud — that is weather control.**

<img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=EF4444&section=footer" width="100%"/>

### 1️⃣ The Differentiation — Real Worker vs Pre-Positioned Spoofer

*How gigHood distinguishes a genuinely stranded delivery partner from a Telegram syndicate member who pre-seeded their PoP pings 3 hours early and is now at home with their spoofing app still running.*

Three gates must all pass before any payout releases. Failing any one routes the claim to manual review regardless of Trust Score. The gates are designed knowing that sophisticated attackers can pre-seed pings continuously, stay "Available" on the platform, and have clean historical records.

<img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=db8947&section=footer" width="100%"/>

#### Gate 1 — GPS Coordinate Variance Analysis (Defeats the Plugged-In Sleeper Device)

The previous defense relied on ping count continuity — which a plugged-in spoofing device defeats trivially by simply staying on. The correct signal is **coordinate variance**, not ping count.

A genuine worker riding through a storm in a 1.2km hex generates GPS readings with measurable jitter — weather interference, movement, signal multipath from rain. A spoofed device emitting from a static home location generates a mathematically perfect coordinate stream, even with artificially injected noise.

```
For each PoP ping within the 90-minute window, record:
  - GPS coordinate (lat, lng)
  - Accuracy radius reported by the OS
  - Network signal strength at time of ping

Compute over the 90-minute window:
  Coordinate_Variance  =  std_dev(lat readings) + std_dev(lng readings)
  Accuracy_Variance    =  std_dev(accuracy_radius readings)

Genuine worker in storm:
  Coordinate_Variance:    HIGH  (movement + weather multipath)
  Accuracy_Variance:      HIGH  (signal fluctuation in rain)

Spoofed device (even with injected jitter):
  Coordinate_Variance:    LOW or PATTERN-REGULAR
  Accuracy_Variance:      LOW or ARTIFICIALLY UNIFORM
  (Lockito and similar tools inject jitter algorithmically —
   the noise follows a mathematical pattern, not a physical one)

If Coordinate_Variance < threshold  →  STATIC_DEVICE_FLAG
  Claim routed to Gate 2 verification regardless of ping count
```

This check does not punish workers with connectivity drops — it measures the physical signature of movement vs stasis. A worker stuck sheltering in a doorway during a flood still shows environmental variance from rain interference. A device sitting on a home desk does not.

<img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=db8947&section=footer" width="100%"/>

#### Gate 2 — Platform Order Activity Validation (The Hard Gate — Revised)

This is the most critical gate and requires precise framing. The previous version checked for "Active on Shift" or "Online" status — which a fraudster at home can achieve simply by opening the Zepto rider app and setting themselves as Available.

**The corrected check requires order-level activity, not availability status:**

```
What we check via platform API (mocked in demo, real data partnership in production):

  STRONG confirmation — auto-approved:
    Worker accepted ≥ 1 order OR completed ≥ 1 delivery
    in the 90-minute window before disruption onset
    AND order activity is distributed across the window
    (not a single order completed 85+ minutes before onset
     followed by zero activity — that pattern is flagged as
     PARTIAL_ACTIVITY and routed to soft queue)

    Micro-delivery exclusion: orders where pickup and drop-off
    coordinates are within 100 meters of each other are excluded
    from Gate 2 validation — self-dealing order farming in
    pre-disruption windows is not valid activity confirmation

  WEAK confirmation — routed to soft queue:
    Worker was Online/Available but no order activity recorded
    (genuine — disruption may have halted all incoming orders before they could accept)
    → Passive checks run automatically (coordinate variance, cross-hex graph, fraud score)
    → If passive checks clear (Fraud Score < 50): payout released, no worker action
    → If passive checks inconclusive after 2 hours: claim deferred to end-of-billing-week
      for cross-reference against total weekly platform activity before final payout decision
    → If weekly platform activity confirms regular prior shift pattern: approved
    → If weekly platform activity shows no activity that week: denied with appeal link

  NO confirmation — denied:
    Worker was OFFLINE (app closed, unavailable) during the window
    Platform shows no session activity in the 90 minutes before disruption

Why this matters:
  A fraudster at home can set themselves as Available on the Zepto app.
  They CANNOT fake completed or accepted orders unless they physically
  received and completed deliveries — which they did not.
  
  A genuine worker in the disrupted zone who was active just before the
  storm halted operations will have order history proving their presence.
  A fraudster pre-seeding their location from home will not.
```

**The WEAK confirmation path (online but no orders) exists specifically for honest workers** caught in the early stages of a disruption when orders dried up before they could accept any. They are not penalized — they go to the soft queue, which resolves with additional passive checks within 2 hours.

**Payout maturation rule:** A worker cannot claim a Tier C payout (₹800/day cap) in a week where their 4-week average premium was Tier A (₹20/week). Maximum payout is capped at 2.5× the worker's 4-week average daily payout history. This closes the trust-farm upgrade exploit economically.

<img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=db8947&section=footer" width="100%"/>

#### Gate 3 — Velocity Detection (Repositioned — Last-Minute Hopper Filter Only)

```
If:  distance between last ping outside the claimed hex
     and first ping inside the claimed hex  ÷  time between them
     > 120 km/hr (physically impossible for a 2-wheeler)

Then:  VELOCITY_VIOLATION — routed to soft queue

Limitation acknowledged:
  This check detects last-minute zone hoppers only.
  Against pre-positioned sleeper cells (all pings already inside
  the hex for 3+ hours), there is no velocity violation to detect.
  Gates 1 and 2 handle that case. Gate 3 is a secondary filter.
```

<img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=db8947&section=footer" width="100%"/>

#### Environmental Signals (Supporting Layer — Not a Gate)

Environmental signals (WiFi vs 4G, GPS jitter patterns, battery drain) contribute to the fraud score but do not gate payouts independently. A sophisticated attacker using a 4G dongle and Lockito can defeat most environmental checks. We do not pretend otherwise. These signals raise or lower the fraud probability score and influence which verification path a claim takes. They do not standalone-approve or standalone-deny.

<img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=db8947&section=footer" width="100%"/>

### 2️⃣ The Data — Beyond GPS: Detecting the Distributed Telegram Syndicate

*Data points beyond GPS that detect a 500-person ring spread across 25 hexes.*

The Sybil Scatter attack is invisible at the hex level. The defense operates at the network level across all hexes simultaneously.

<img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=db8947&section=footer" width="100%"/>

#### A. Cross-Hex Device Fingerprint Graph (Defeats Sybil Scatter)

Coordinating 500 accounts produces detectable patterns in the account cohort graph — even when each individual hex appears normal.

```
Fingerprint signals collected at registration:
  - SIM card registration date and carrier
  - gigHood account creation timestamp
  - Device model and Android version
  - GPS mock location provider status (OS-level flag, detectable without package name)

Note on package name detection:
  Root-level GPS injection on Android bypasses package name detection.
  We therefore rely on the OS-level mock location provider flag
  (Settings → Developer Options → Mock location app) which is
  detectable regardless of spoofing method, and on behavioral signals
  below — not on identifying a specific installed app.

Cross-hex graph query at every disruption event:
  Nodes  =  all workers claiming across ALL hexes in this event
  Edges  =  shared fingerprint features

Flag conditions (relative to historical hex composition baseline):
  →  OS-level mock location provider active on ≥ 25 accounts
     distributed across multiple hexes in same event
     →  MOCK_LOCATION_NETWORK flag

  →  ≥ 50 accounts registered on gigHood within the same 72-hour window
     claiming in different hexes simultaneously
     →  REGISTRATION_COHORT flag

  →  Device model frequency in this event exceeds 3× the
     historical baseline frequency for that model in those hexes
     (e.g., Redmi Note 9 normally at 18% of hex devices;
      event shows 54% Redmi Note 9 across 15 hexes = anomaly)
     →  MODEL_CONCENTRATION flag (relative, not absolute threshold)
```

**Critical design note on device model detection:** Absolute thresholds (e.g., "≥20 Redmi Note 9") produce false positives in Tier-1 Indian cities where a small number of budget models dominate the gig worker market. All device model flags use **relative frequency vs historical hex baseline**, not absolute counts. This prevents flagging genuine Zepto riders who happen to own the same affordable phone.

<img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=db8947&section=footer" width="100%"/>

#### B. Uniform Partial Participation Anomaly (Probabilistic Signal — Not a Gate)

Syndicates instruct members to claim at 60–70% to mimic organic behavior. A Telegram admin can defeat a fixed threshold by randomizing instructions per hex group. This signal is therefore positioned as a **probabilistic contributor to fraud score**, not a standalone gate.

```
What we measure:
  Participation rate variance across all affected hexes in one event

Organic expectation:
  High variance — some hexes 45%, others 88%, natural distribution

Fraud signal:
  Low variance — most hexes clustering in a narrow band

How it's used:
  Contributes +15 to fraud score if variance is statistically low
  Does NOT independently freeze claims
  Combined with fingerprint graph and order activity, forms a
  compound fraud probability score

A syndicate can randomize participation rates per Telegram subgroup.
We acknowledge this. The signal remains useful as one input among many.
```

<img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=db8947&section=footer" width="100%"/>

#### C. Coordinated Entry Window (Probabilistic Signal — Not a Gate)

Same limitation applies. A Telegram admin can stagger zone activation by hex group with one message. This signal contributes to fraud score rather than gating claims independently.

```
What we measure:
  Entry timestamp distribution across hexes in the same event

Organic expectation:
  Different hexes activate at different times — workers are at different
  distances from their stores, have different shift timings, different
  awareness of the storm

Fraud signal:
  Multiple hexes showing entry clusters in the same narrow time band
  (even if staggered by group — the inter-group staggering itself
   has a lower-variance pattern than organic hex-level awareness)

Contribution:  +10 to fraud score if cross-hex entry correlation is high
```

<img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=db8947&section=footer" width="100%"/>

#### D. Earnings Declaration Distribution Check

A syndicate instructed to declare earnings just below the 90th percentile flag threshold produces a suspicious cluster just below the cutoff.

```
At payout time, for each disruption event affecting ≥ 10 hexes:

  Compute the distribution of declared daily earnings
  across all claiming workers in the event

  Organic expectation:
    Bell curve centered on zone average, natural variance

  Fraud signal:
    Spike of declarations clustering just below the 90th percentile
    threshold — statistically inconsistent with organic distribution
    →  DECLARATION_CLUSTERING flag
    →  Affected accounts routed to soft queue for earnings re-verification
```

<img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=db8947&section=footer" width="100%"/>

#### E. H3 Hex Density Cap (Catches Naive Attacks)

```
Per-hex capacity:  ~50–80 active Q-commerce riders (operational estimate)
Flag threshold:    > 90 claims from one hex  →  CAPACITY_VIOLATION
```

Against a distributed syndicate this is a secondary filter. It catches unsophisticated attackers who do not know the threshold.

<img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=db8947&section=footer" width="100%"/>

#### F. Compound Fraud Probability Score

Individual signals are probabilistic. The system combines them:

```
Fraud_Score = (Gate 1 variance flag × 30)
            + (Gate 2 order activity status × 40)
            + (OS mock location flag × 20)
            + (Registration cohort flag × 15)
            + (Model concentration flag × 10)
            + (Participation variance flag × 15)
            + (Entry window correlation × 10)
            + (Declaration clustering flag × 10)

Score < 30:   Path 1 — Fast Track
Score 30–59:  Path 2 — Soft Queue
Score 60–79:  Path 3 — Active Verify
Score ≥ 80:   Path 4 — Denied + Appeal
```

Gate 2 (order activity) carries the highest weight because it is the least gameable signal. A fraudster at home cannot fake completed deliveries.

<img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=db8947&section=footer" width="100%"/>

### 3️⃣ The UX Balance — Protecting Honest Workers Without Creating Loopholes

*How gigHood handles flagged claims without penalizing genuine workers experiencing connectivity issues, sparse orders before the disruption, or proximity to a fraud cluster.*

> **Design Rule: Order activity is the gate. Everything else determines speed.**

<img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=db8947&section=footer" width="100%"/>

#### The Four-Path Response Framework

```
Path 1 — FAST TRACK
  Conditions:   Gate 2 STRONG (order confirmed) + Fraud Score < 30
  Action:       Payout released automatically within 90 seconds
  Worker sees:  "₹480 credited — income protected"

Path 2 — SOFT QUEUE
  Conditions:   Gate 2 WEAK (online, no orders) OR Fraud Score 30–59
  Action:       Passive verification — environmental signals + cross-hex
                graph checked automatically, no worker action needed
  SLA:          2 hours
  Worker sees:  "Your payout is being verified — we'll notify you shortly"

Path 3 — ACTIVE VERIFY
  Conditions:   Gate 2 STRONG + Fraud Score 60–79
                (legitimate worker flagged by network anomaly)
  Action:       1-tap FCM prompt — worker confirms current position
                one-time secure GPS fetch on tap
  SLA:          30 min for HIGH trust, 2 hours for others
  Worker sees:  "We noticed unusual activity near your zone.
                 Tap here to confirm your location — takes 5 seconds."

Path 4 — DENIED + APPEAL
  Conditions:   Gate 2 NO CONFIRMATION (OFFLINE) OR Fraud Score ≥ 80
  Action:       Claim denied, appeal link provided
  SLA:          Human review — see scalability framework below
  Worker sees:  "We couldn't verify your shift activity during this event.
                 If you were working, tap here to raise a support ticket."
```

<img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=db8947&section=footer" width="100%"/>

#### Human Review Scalability Framework

A Mumbai monsoon event affecting 15+ hexes simultaneously can produce hundreds of Path 4 denials at once. A flat 4-hour SLA for all of them is operationally unrealistic.

```
Triage queue at scale:

Priority 1 (resolved < 1 hour):
  Workers with WEAK Gate 2 (online, no orders) + HIGH Trust Score
  Most likely genuine — disruption halted orders before they could accept

Priority 2 (resolved < 2 hours):
  Workers with WEAK Gate 2 + MEDIUM Trust Score
  Checked against historical shift schedule and zone assignment

Priority 3 (resolved < 4 hours):
  Workers with NO Gate 2 confirmation + HIGH Trust Score
  Edge case — app crash, device restart, connectivity failure

Priority 4 (resolved < 8 hours):
  Workers with NO Gate 2 + LOW Trust Score + HIGH Fraud Score
  Lowest priority — most likely fraudulent, but appeal right preserved

Auto-scaling:
  If Priority 1 queue exceeds 100 workers:
    Automated passive check runs first (cross-reference last 4-week
    shift schedule against claimed hex assignment)
    If consistent → auto-approve without human reviewer
    If inconsistent → escalate to Priority 3
```

<img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=db8947&section=footer" width="100%"/>

#### Trust Score Dampening During High-Risk Events

```
Normal conditions:      HIGH trust → Path 1 (auto-clear)

High-risk event flag:   Trust Score reduces fraud score by max 10 points
(active attack detected) It cannot change a Path 4 denial to Path 1
                         It can accelerate Path 2 → 30 min SLA
                         It can accelerate Path 3 → 30 min SLA

Trust Score CANNOT:
  →  Override a Gate 2 NO CONFIRMATION verdict
  →  Convert a Fraud Score ≥ 80 into auto-approval
  →  Bypass the payout maturation cap
```

<img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=db8947&section=footer" width="100%"/>

#### The Cluster Suppression Protocol

```
Step 1:  Cross-hex fingerprint graph detects DISTRIBUTED_RING
Step 2:  Identify workers in flagged hexes with organic patterns:
           - Gate 2 STRONG (order confirmed)
           - OS mock location flag: absent
           - Fraud Score < 30
Step 3:  Release these workers via Path 1 immediately — unaffected
Step 4:  Apply compound fraud score to flagged cluster accounts
Step 5:  Log full cluster event for insurer admin dashboard:
           hex IDs, account cohort, device fingerprint map,
           fraud scores, payout decisions
```

Honest workers in the same hexes as an attack are never penalized as long as they have confirmed order activity. The suppression is surgical: score-based, not geography-based.

<img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=db8947&section=footer" width="100%"/>

#### Final Defense Architecture

```
Layer 0  →  DCI cannot be spoofed (external infrastructure only)
Layer 1  →  GPS coordinate variance (movement physics — not ping count)
Layer 2  →  Platform order activity (deliveries, not "online" status)
Layer 3  →  Payout maturation cap (destroys trust-farm upgrade ROI)
Layer 4  →  OS-level mock location detection (method-agnostic spoofing flag)
Layer 5  →  Cross-hex network graph (distributed ring visible at event level)
Layer 6  →  Compound fraud score (probabilistic, multi-signal, not threshold-gated)
Layer 7  →  Triage-prioritized human review (scales under mass event load)
```

> **"Fraud does not appear as anomalies — it appears as statistically normal behavior replicated at scale. Our defense validates consistency across order activity, coordinate physics, platform-confirmed history, and cross-hex network structure — not any single signal."**
>
> **"If 500 workers lie together across 25 hexes — we detect the impossibility of their shared order history."**
<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/colored.png" width="100%">


<div align="right"><a href="#table-of-contents">⬆ Back to Top</a></div>


## 🔔 Proactive Coverage Alerts

This feature transforms gigHood from a reactive payout tool into a **forward-looking financial tool** — the single most important UX differentiator.

Every Sunday evening, the DCI forecasting model (using 7-day weather forecasts fused with historical DCI patterns) computes a next-week risk score for each active hex. Workers in elevated-risk zones receive a push notification:

```
🌧️ gigHood Alert — Next Week Risk Score: HIGH (0.79)

Your zone shows elevated disruption probability next week.
Your current tier: Tier B — ₹700/day coverage

Upgrade to Tier C for next week — ₹42 instead of ₹30.
Coverage doubles to ₹1,400/day for the full week.

Offer closes tonight at midnight.
Your next weekly premium will reflect your choice.

[Upgrade to Tier C]  [Keep Tier B]
```

This serves three purposes simultaneously:

1. **Worker value perception.** The worker sees the system is watching for them before anything has gone wrong. This reduces churn dramatically and builds the kind of trust that drives word-of-mouth in tight-knit dark store communities.
2. **Pool solvency management.** Voluntary tier upgrades add premium revenue precisely when expected claim costs are higher, improving the insurer's loss ratio without coercive or dynamic repricing.
3. **Financial agency.** Gig workers currently have no tools to manage income risk proactively. gigHood gives them a weekly decision they can make with full information — the risk score, the cost, and the upside — before a disruption hits.

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/colored.png" width="100%">

<div align="right"><a href="#table-of-contents">⬆ Back to Top</a></div>

# 👤 Persona & Scenario

### Ravi Kumar — Primary Persona

<table>
<tr>
<td width="40%" align="center">

<img src="https://github.com/user-attachments/assets/b4984620-6794-42ce-865e-a217cc725aec" width="200"/>

</td>

<td width="60%" valign="top">

| Attribute | Detail |
|:----------|:-------|
| Age | 26 |
| City | Bengaluru |
| Platform | Zepto / Blinkit |
| Work Model | Dark store-based delivery (2–3 km radius) |
| Average weekly income | ₹4,500 |
| Best week | ₹6,200 |
| Worst monsoon week | ₹1,800 |
| Vehicle | 2-wheeler |
| Device | Android smartphone |
| Payment method | UPI |

> *"If heavy rain shuts down my zone, I lose the entire day's income."*

</td>
</tr>
</table>

<img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=db8947&section=footer" width="100%"/>

### Ravi's Week with gigHood

#### 🟢 Monday Morning — Policy Activation
- Opens **gigHood app**
- Views **zone-level risk (DCI score)**
- Assigned **Tier B plan — ₹30/week**
- Payment auto-deducted via UPI  
- ✅ Policy activated instantly  

<img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=db8947&section=footer" width="100%"/>

#### 🌧 Wednesday — Disruption Detected
- Rainfall exceeds **35mm/hr** in Ravi’s hex zone  
- **DCI recalculated → crosses 0.85 threshold**  
- Zone marked as **economically disrupted**  
- System identifies all active workers in the zone  
- **Proof-of-Presence (last 90 mins) → Valid**  
- Payout calculated based on disrupted hours  
- 💰 **₹480 credited via UPI**  

<img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=db8947&section=footer" width="100%"/>

#### 🌙 Wednesday Evening — Outcome
- Notification received:  
  > *"₹480 credited — income protected"*  
- No claim filed  
- No manual action required  
- ✅ Fully automated protection
<img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=db8947&section=footer" width="100%"/>

### Priya Sharma — Secondary Persona

<table>
<tr>
<td width="40%" align="center">

<img width="111" height="802" alt="image" src="https://github.com/user-attachments/assets/bd56c5cf-38cf-4950-a189-f0b4f4f6c867" />

</td>

<td width="60%" valign="top">

| Attribute | Detail |
|:----------|:-------|
| Age | 31 |
| City | Mumbai |
| Platform | Zepto (Instamart zone) |
| Work Model | Dark store-based delivery (1–2 km radius) |
| Average weekly income | ₹3,800 |
| Best week | ₹5,400 |
| Worst monsoon week | ₹900 |
| Vehicle | 2-wheeler |
| Device | Android smartphone |
| Payment method | UPI |

> *"During the Mumbai floods, the entire zone shuts for 2–3 days. My husband and I both lose income at the same time — there is no backup."*

</td>
</tr>
</table>


#### Priya's Scenario — AQI Spike + Curfew Combination

**Before:** Priya works a Zepto dark store in Dharavi zone, Mumbai. November brings both post-Diwali AQI spikes (often >350) and periodic local bandhs. She earns ₹520–₹650 on good days, nothing on disruption days.

**During:** On a Thursday morning, AQI crosses 320 in her hex. Platform operations are suspended. DCI recomputes at 9 AM with elevated signals: `W=0.80` (AQI 320 + moderate wind), `T=0.40` (delivery traffic slowing), `P=0.90` (platform order volume dropped 80%), `S=0.50` (partial zone closure advisory). Applying the formula: `σ(0.45×0.80 + 0.25×0.40 + 0.20×0.90 + 0.10×0.50)` = `σ(0.36 + 0.10 + 0.18 + 0.05)` = `σ(0.69)` = **`DCI = 0.67`** — elevated watch state, worker alerted but no payout yet. By 11 AM, AQI hits 380, platform fully suspends operations, local curfew advisory issued. Signals escalate: `W=1.0, T=0.80, P=1.0, S=0.80`. Note: each signal is a composite score that can exceed 1.0 on the raw scale before sigmoid normalization — W combines rainfall intensity, wind speed, and AQI into a severity index; at extreme AQI 380 + wind, W raw = 1.4. Full computation: `σ(0.45×1.4 + 0.25×0.80 + 0.20×1.0 + 0.10×0.80)` = `σ(0.63 + 0.20 + 0.20 + 0.08)` = `σ(1.11)` = **`DCI = 0.75`** — approaching threshold. With full platform shutdown and curfew escalation (P=1.2 raw, S=1.0 raw): `σ(0.63+0.20+0.24+0.10)` = `σ(1.17)` = **`DCI = 0.76`**. DCI crosses 0.85 when compounded signals reach raw sigmoid input of 1.95+ — achievable during simultaneous extreme AQI + full platform outage + active curfew. Priya's PoP log shows 6 pings in the prior 90 minutes. Platform confirms 3 orders completed before 10 AM. Claim initiated automatically.

**After:** ₹390 credited via UPI (3.1 disrupted hours × ₹126/hr average). No form. No call. No waiting.
<img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=db8947&section=footer" width="100%"/>

## 🎯 Why This Persona Matters

Quick-commerce delivery partners operate within **fixed hyperlocal zones (1–3 km radius)** centered around dark stores.

This makes them uniquely suitable for gigHood because:

- Disruptions are **zone-specific**, not city-wide  
- Income can drop to **zero instantly**  
- Work is highly dependent on **mobility and platform uptime**  

gigHood’s **H3 spatial model + DCI engine** aligns directly with this operational structure, enabling precise disruption detection and automated compensation.
<img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=db8947&section=footer" width="100%"/>

## 📐 Parametric Insurance Model

### Traditional vs Parametric

| Dimension | Traditional Insurance | Parametric (gigHood) |
|-----------|---------------------|----------------------|
| Trigger | Individual loss verified | Zone-level disruption (DCI threshold) |
| Claim filing | Manual, documented | **None required** |
| Settlement time | Weeks to months | **Minutes (< 90s)** |
| Proof required | Extensive documentation | **Zero** |
| Fraud surface | High (self-reported) | **Low (objective signals + PoP)** |
| Suitable for gig workers | ❌ | ✅ |

<img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=db8947&section=footer" width="100%"/>


### End-to-End Parametric Flow

    External signals detected (weather, traffic, platform status)
            |
            v
    DCI computed for each zone
            |
            v
    DCI > 0.85 → Zone marked as disrupted
            |
            v
    Active workers in zone identified
            |
            v
    Proof-of-Presence validation (last 90 mins)
            |
            v
    Payout calculated based on disruption duration
            |
            v
    UPI transfer executed via Razorpay
            |
            v
    Worker notified via app + FCM push notification

**No claim. No paperwork. No delay.**

<img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=db8947&section=footer" width="100%"/>

### 🚫 Policy Exclusions

gigHood is designed for income loss caused by **external, objective, infrastructure-level disruptions**. The following events fall outside the scope of coverage and will not trigger a payout:

| Exclusion | Reason |
|:----------|:-------|
| **War, armed conflict, or civil war** | Force majeure — outside parametric risk modelling scope |
| **Government-declared national emergency or pandemic shutdown** | System-wide closure invalidates zone-level DCI differentiation |
| **Platform-initiated worker account deactivation** | Account suspension is an individual action, not a zone disruption |
| **Disruptions lasting less than the minimum trigger duration** | DCI must remain above 0.85 for a sustained window — brief spikes do not qualify |
| **Claims during the 7-day waiting period** | New accounts receive a reduced coverage cap (zone 50th percentile), not a full payout |
| **Zones below the minimum policyholder density threshold** | Pool viability requires a minimum active worker base per hex to process claims |
| **Self-inflicted platform outages (worker app issues, personal device failure)** | Individual technical failures are not zone-level disruptions |
| **Disruptions in zones outside the worker's registered dark store assignment** | Coverage is tied to the registered hex — zone-hopping is detected and denied |

These exclusions are standard across all non-life parametric insurance products operating under the IRDAI Regulatory Sandbox framework and are disclosed to workers at onboarding.

<img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=db8947&section=footer" width="100%"/>

## 🤖 AI / ML Integration

gigHood uses controlled and explainable machine learning.

### Core ML Components

| Component | Model | Exact Role |
|-----------|-------|------|
| Risk Band Classification | XGBoost | Assigns each worker to Tier A/B/C using zone's 12-week DCI history, seasonal weather patterns, flood-proximity, claim frequency |
| DCI Weight Optimization | XGBoost (weekly retrain) | Updates α, β, γ, δ signal weights based on real disruption outcomes — model converges in 6–8 weeks |
| Disruption Forecasting | Rolling average + seasonal index | Predicts next-week zone risk for proactive tier upgrade alerts — no LSTM required at MVP stage |
| Fraud Anomaly Detection | Compound fraud score | GPS coordinate variance, platform order activity validation, OS-level mock location detection, cross-hex fingerprint graph, multi-signal weighted scoring |

> The DCI computation itself is a **deterministic sigmoid** over ML-optimized weights — not a black-box neural network. This makes it auditable and explainable — a deliberate design choice for regulatory review.

### Regulatory Pathway

Parametric income insurance for gig workers sits in a grey area under current IRDAI regulations — we do not claim blanket compliance. gigHood's production pathway would operate under **IRDAI's Regulatory Sandbox framework** (Insurance Regulatory and Development Authority of India, Regulatory Sandbox Guidelines 2019, updated 2023), which permits innovative insurance products to operate under a supervised pilot licence for up to three years. The income-loss parametric structure would be co-underwritten with a licensed non-life insurer holding the risk, with gigHood acting as the technology and distribution layer. This is the same structure used by weather index crop insurance products currently operating in India under IRDAI oversight. Weekly premium collection via UPI is compliant with IRDAI's digital payment norms under the Insurance Amendment Act 2021.

### Cold-Start Strategy

On Day 1, no historical claim data exists. Weights are bootstrapped using:
- IMD historical rainfall records mapped to delivery downtime
- IMD-correlated urban mobility datasets from open government data portals (data.gov.in)

```
Initial heuristic priors:
  α = 0.45  (weather — dominant factor for Q-commerce outdoor workers)
  β = 0.25  (traffic — secondary mobility factor)
  γ = 0.20  (platform — outage detection)
  δ = 0.10  (social — least frequent disruption type)
```
<img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=db8947&section=footer" width="100%"/>


### ML Pipeline

    External APIs (Weather, AQI, Traffic, Platform)
            |
            v
    Data Ingestion Layer
            |
            v
    Feature Engineering (zone-level)
            |
            v
    DCI Computation Engine
            |
            v
    Trigger Detection
            |
            v
    Proof-of-Presence Validation
            |
            v
    Automated Payout Execution

<img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=db8947&section=footer" width="100%"/>


### Fraud Prevention — Proof of Presence (PoP)

Instead of generic fraud scoring, gigHood uses time-based location validation.

Rule:

    Worker must be present in the affected zone
    within 90 minutes before disruption

| Check | Purpose |
|------|--------|
| Location history | Prevent zone hopping |
| Earnings validation | Prevent inflation |
| Claim frequency | Detect abnormal patterns |
<img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=db8947&section=footer" width="100%"/>


<div align="right"><a href="#table-of-contents">⬆ Back to Top</a></div>


## 📱 Application Workflow

### Worker Onboarding

    1. Download gigHood app
    2. Register via mobile + OTP
    3. Auto-detect work zone
    4. Risk profile generated using DCI history
    5. Tier assigned automatically
    6. Weekly premium activated via UPI
    7. 7-day waiting period begins (adverse selection protection)
       New accounts: coverage cap set at zone 50th percentile earnings
       for first two weeks until baseline is established
    8. Full coverage activates after waiting period
       Renewal accounts: coverage activates Monday morning, no waiting period

> **Why a waiting period?** Without it, a worker who registers 48 hours before a forecasted cyclone gets immediate full coverage — a classic adverse selection problem that any insurance-domain judge will probe. The 7-day waiting period closes this. Legitimate gig workers who experience disruptions in their first week are covered at the reduced cap; they are not excluded entirely.

<img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=db8947&section=footer" width="100%"/>


### Weekly Policy Cycle

    Monday     → Premium auto-deducted
                  Policy active for 7 days

    During week → DCI monitored continuously
                  If threshold crossed → payout triggered

    Sunday     → Weekly summary sent
                  (coverage, payouts, next week risk)
<img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=db8947&section=footer" width="100%"/>


### End-to-End Payout Flow (< 90 seconds)

    Disruption detected (DCI > 0.85)
      └── Worker in affected zone
      └── Policy active
      └── Proof-of-Presence validated
      └── Payout calculated
      └── UPI transfer executed
      └── Notification sent

<img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=db8947&section=footer" width="100%"/>

### Voice AI Assistant

Workers interact naturally — no reading required.

```
Worker speaks  →  "What happens if it rains tomorrow?"
                         |
                         v
              Speech-to-text transcription
                         |
                         v
          LLM generates plain-language response
          (OpenRouter/Groq + worker profile context)
                         |
                         v
       Text-to-speech in worker's preferred language
```

**Supported languages:** Hindi · Kannada · Tamil · Telugu · English


<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/colored.png" width="100%">



## 🏗️ Tech Stack & Architecture

### MVP Stack — What We Build and Demo (Free Tier, Zero Cost)

| Layer | Technology | Justification |
|------|------------|---------------|
| Worker App | React Native (Expo) | Native background location APIs required for PoP fraud engine |
| Admin Dashboard | Next.js + Tailwind CSS on Vercel free tier | SSR for live data; Vercel free tier handles full demo load |
| Backend API | Python + FastAPI | Native ML model serving; async endpoints for DCI computation |
| Scheduled Jobs | APScheduler (in-process) | DCI recomputation every 5 min inside FastAPI — no Redis needed |
| ML Models | XGBoost + Scikit-learn | Risk band classification + DCI weight optimization |
| Database | Supabase free tier (PostgreSQL + PostGIS) | PostGIS + H3 extension pre-enabled; 500MB free; no card required |
| Spatial Index | H3 Python library | Hex-grid computation, runs on Supabase backend |
| Payments | Razorpay Sandbox | UPI payout simulation; webhooks; fully free in test mode |
| Notifications | Firebase FCM (free tier) | Push notifications to worker app |
| Signal APIs | OpenWeatherMap free tier, CPCB AQI API (free), Maps mock, Gov alert mock | All free or mocked |
| Backend Hosting | Render free tier | Hosts FastAPI + APScheduler; sufficient for hackathon demo |

### Scaled Production Stack (Post-Hackathon Roadmap)

| Layer | Technology |
|------|------------|
| Backend Hosting | AWS ECS (containerized) |
| Database | AWS RDS PostgreSQL + TimescaleDB (time-series) |
| Cache / Queue | Redis + Celery workers |
| API Gateway | Kong |
| Secondary Service | Node.js microservice for notification routing |
| ML Forecasting | Retrained seasonal model (XGBoost time-series variant) |

### Microservices

| Service | Responsibility |
|--------|---------------|
| Policy Engine | Tier assignment, activation, renewal |
| Risk Engine | DCI computation, zone risk scoring |
| Trigger Monitor | Real-time signal ingestion + threshold detection |
| Claim Engine | Payout calculation + orchestration |
| Fraud Detection | Proof-of-Presence + compound fraud score validation |
| Payment Service | Razorpay UPI payouts |
| Notification Service | FCM push alerts |
| Auth Service | OTP login, JWT |


<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/colored.png" width="100%">

## 🗓️ Development Plan

### Phase 1 — Ideation & Foundation [March 4–20] ✅ Complete

- [x] Problem research and persona selection (Q-commerce — Zepto/Blinkit)
- [x] Parametric trigger design (5 independent triggers)
- [x] DCI-based architecture and formula design
- [x] Weekly pricing model (₹20–₹42 tiers, 4-week rolling average)
- [x] System architecture planning (5 primary layers + fraud intelligence layer)
- [x] Cold-start ML strategy (IMD priors + XGBoost bootstrapping)
- [x] Adversarial defense architecture and anti-spoofing strategy (Market Crash response — 7-layer defense with compound fraud score)
- [x] README and GitHub repository setup

<img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=db8947&section=footer" width="100%"/>


### Phase 2 — Automation & Protection [March 21–April 4]

- [ ] FastAPI backend setup on Render free tier
- [ ] Supabase database setup (PostgreSQL + PostGIS + H3)
- [ ] External API integration (OpenWeatherMap, CPCB AQI)
- [ ] DCI computation engine with APScheduler (every 5 min)
- [ ] H3 spatial grid implementation
- [ ] Trigger detection engine (5 independent triggers)
- [ ] Worker mobile app UI — onboarding + policy dashboard (React Native)
- [ ] Dynamic premium calculation (XGBoost risk band classifier)
- [ ] Claims management — zero-touch automated flow with **basic PoP** (ping count + zone assignment check). Note: Phase 2 implements foundational fraud prevention only. The full adversarial defense layer — GPS coordinate variance, platform order activity validation, and cross-hex fingerprint graph — is added in Phase 3 on top of the Phase 2 claims pipeline.
- [ ] Razorpay sandbox UPI payout integration

<img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=db8947&section=footer" width="100%"/>


### Phase 3 — Scale & Optimise [April 5–17]

- [ ] Proof-of-Presence fraud engine (WorkManager + BackgroundTasks + GPS fallback)
- [ ] Advanced fraud gates (earnings inflation, claim frequency anomaly, cluster detection)
- [ ] Adversarial defense layer (GPS spoof detection, coordinated cluster flagging)
- [ ] Admin dashboard (Next.js on Vercel — live hex map, pool health, claim log)
- [ ] Proactive tier upgrade alert system (Sunday evening DCI forecast)
- [ ] AI Chat Assistant (OpenRouter/Groq API — policy, payout, and risk explanations in Hindi/English)
- [ ] XGBoost weekly retrain pipeline (DCI weight optimization)
- [ ] Degraded-mode fallback (< 3 signals available)
- [ ] End-to-end disruption simulation demo
- [ ] Final submission package
<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/colored.png" width="100%">

<div align="right"><a href="#table-of-contents">⬆ Back to Top</a></div>


## 📊 Analytics Dashboard

gigHood provides dual dashboards — one for workers, one for insurers — built in Phase 3.

### Worker Dashboard

| Panel | What It Shows |
|:------|:-------------|
| Active Coverage | Current tier, weekly premium paid, coverage cap for the week |
| Zone Risk Today | Live DCI score for their hex with traffic-light indicator |
| Protection History | Timeline of past disruption events, claims triggered, payouts received |
| Proactive Alert | Next-week risk forecast and tier upgrade option (Sunday evenings) |

### Insurer / Admin Dashboard

| Panel | What It Shows |
|:------|:-------------|
| Live Hex Map | H3 grid colour-coded by DCI level — red (disrupted), amber (elevated), green (normal) |
| Active Policies | Count of active workers by zone, tier distribution, weekly premium pool total |
| Trigger Events | Real-time log of DCI threshold crossings — timestamp, hex ID, signals that fired |
| Claims Processed | Auto-approved vs flagged vs denied — with fraud reason codes |
| Fraud Detection Metrics | PoP validation rate, zone-hop attempts caught, cluster flags raised |
| Payout Summaries | Total disbursed this week, average payout per event, loss ratio tracker |
| Predictive Risk Panel | Next 7-day disruption forecast by zone — expected claim volume and pool sufficiency |

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/colored.png" width="100%">

## 📈 Business Viability

<img width="1000" height="467"  alt="Quick Commerce Market Size"  src="https://github.com/user-attachments/assets/5c39641b-950e-436b-81b3-50eb8fbadb25" />

### Market Opportunity

| Metric | Value |
|-------|-------|
| Gig workforce (India) | 15M+ |
| Projected (2030) | 23.5M |
| Target (hyperlocal workers) | 8M |
| Market size | ₹6,000+ crore |

<img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=db8947&section=footer" width="100%"/>


### Revenue Streams

| Stream | Model | Description |
|--------|------|------------|
| Weekly premiums | B2C | Primary revenue |
| Platform partnerships | B2B | Integration with delivery platforms |
| Insurance APIs | B2B | License DCI engine |
| Data insights | SaaS | Urban disruption analytics |

<img src="https://capsule-render.vercel.app/api?type=rect&height=2&color=db8947&section=footer" width="100%"/>


### Unit Economics — Honest Assessment

```
Weekly premium (Tier B):        ₹30/worker
Average payout per event:       ₹480/worker
Expected disruption events:     1.5/week (monsoon baseline, RedSeer 2023)
Claim trigger probability:      0.40 (DCI > 0.85 given a disruption day)

Expected weekly claim cost:     ₹480 × 1.5 × 0.40 = ₹288/worker
At ₹30 premium → Loss ratio:   960% per worker in isolation
```

This ratio is not viable at single-worker level — and we are not hiding it. This is how parametric insurance actually works: **the pool is the product, not the individual policy.**

```
At scale — 10,000 workers across 50 hexes:
  Not all hexes disrupt simultaneously
  Dry-season weeks (Oct–May) have near-zero claims
  Monsoon subscription at ₹80/week (Jun–Sep) re-prices the risk correctly

Diversified pool loss ratio target:   60–65%
Gross margin at 65% loss ratio:       ₹10.5/worker/week
At 100,000 workers:                   ₹10.5 lakh/week margin
```
**Minimum viable pool size:** The loss ratio crosses into actuarial viability at approximately **3,000 workers across 20+ hexes in a single city**, where non-simultaneous disruption patterns across hexes bring the effective weekly loss ratio below 70%. Below this threshold, gigHood operates as a pilot with reduced coverage caps to manage pool exposure.

**Catastrophic event protection:** A single extreme event — such as a Chennai cyclone disrupting 80% of active hexes in one week — could wipe an undiversified pool. gigHood addresses this through two mechanisms: (1) a **reserve fund** maintained at 20% of cumulative weekly premium revenue, building a buffer over time; and (2) at production scale, a **reinsurance arrangement** with a licensed non-life insurer to cap single-event losses above a defined threshold. This is standard practice for parametric insurance products operating under the IRDAI Sandbox framework.

The path to viability is pooling across geographies and seasons — the same principle that makes all micro-insurance products work.
<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/colored.png" width="100%">

## ✅ Compliance with Problem Statement Constraints

| PS Constraint | gigHood Implementation |
|:---|:---|
| **Income loss only** — no health, vehicle, or accident coverage | DCI triggers income loss payouts exclusively. No health, vehicle repair, accident, or life cover exists anywhere in the system. |
| **Weekly pricing model strictly** | 4-week rolling DCI average sets tier. Weekly UPI auto-debit. No daily or per-event pricing. Tier upgrades apply to next full billing week. |
| **Chosen delivery persona — one sub-category** | Q-Commerce only — Zepto and Blinkit dark store partners. Food delivery and e-commerce explicitly excluded. |
| **3–5 automated parametric triggers** | Five independent triggers: rainfall ≥35mm/hr, AQI >300, traffic gridlock, platform outage, verified curfew/bandh. All feed the DCI composite. |
| **Automated coverage and payouts** | Zero-touch claims engine. Worker never files a claim. DCI threshold crossing initiates full payout pipeline automatically. |
| **Intelligent fraud detection** | Compound fraud probability score combining GPS coordinate variance, platform order activity validation, OS-level mock location detection, cross-hex device fingerprint graph, uniform participation anomaly, earnings declaration distribution check, and trust-tiered four-path response framework. |

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/colored.png" width="100%">

## 🎯 MVP Demo Scope — Built vs Mocked

| Component | Demo Status |
|:---|:---|
| DCI computation engine | **Built** — real signal ingestion + sigmoid formula via APScheduler |
| Weather and AQI signals | **Real** — OpenWeatherMap free tier + CPCB AQI API |
| Traffic and platform signals | **Mocked** — simulated API responses |
| H3 spatial grid | **Built** — h3 Python library on Supabase PostGIS |
| Basic PoP (Phase 2) | **Built** — ping count + zone assignment check |
| Full adversarial fraud engine (Phase 3) | **Built** — GPS coordinate variance, platform order activity validation, OS-level mock location flag, cross-hex fingerprint graph, compound fraud score |
| Platform order activity API | **Mocked** — simulated Zepto/Blinkit order history API |
| Razorpay UPI payouts | **Sandbox** — test mode, not live transactions |
| XGBoost risk classification | **Built** — trained on synthetic + IMD historical data |
| Proactive tier upgrade alerts | **Built** — Sunday DCI forecast + weekly tier upgrade prompt |
| AI Chat Assistant | **Built** — OpenRouter/Groq API with worker policy context injection |
| Admin dashboard | **Built** — Next.js on Vercel free tier |
| Payout maturation cap | **Built** — enforced at claim calculation stage |
| Seasonal forecasting model | **Mocked** — rolling average used at MVP; full retrain in production |

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/colored.png" width="100%">

## 📏 Target Success Metrics

| Metric | Target | How Measured |
|:---|:---:|:---|
| Claim trigger accuracy | >90% | DCI threshold correctly identifies halted zones vs ground truth |
| Fraud false-positive rate | <5% | Legitimate workers wrongly denied by compound fraud engine |
| Payout latency | <90 seconds | DCI threshold crossing to UPI credit confirmation (Path 1) |
| PoP validation accuracy | >95% | Zone-hop attempts correctly flagged before payout |
| Coordinated ring detection rate | >80% | Distributed Telegram-style attacks flagged before payout release via cross-hex fingerprint graph |
| Target loss ratio at scale | 60–65% | At 3,000+ workers across 20+ hexes, diversified pool (minimum viable threshold) |
| Worker onboarding time | <3 minutes | Registration to active policy |

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/colored.png" width="100%">

<div align="right"><a href="#table-of-contents">⬆ Back to Top</a></div>


## 👥 Team

<div align="center">

**gigHood — Building the future of financial protection for India's gig workers**

*AI-powered parametric income insurance, built for the last mile.*

</div>

<br/>

<table align="center">
<tr>

<td align="center" width="160">
<img src="https://github.com/user-attachments/assets/b6cb8da1-287a-422b-8e34-467d9a32b2af"
width="120" height="120"
style="border-radius:50%; object-fit:cover;" />
<br/><b>Vishnu Gupta</b>
<br/><sub>Team Leader</sub>
</td>

<td align="center" width="160">
<img src="https://github.com/user-attachments/assets/92e6b236-f03c-4b02-bf6d-8983565c5914"
width="120" height="120"
style="border-radius:50%; object-fit:cover;" />
<br/><b>Abhay Kumar</b>
<br/><sub>Team Member</sub>
</td>

<td align="center" width="160">
<img src="https://github.com/user-attachments/assets/1c6e82f5-3f00-40f4-b316-f34b305076d4"
width="120" height="120"
style="border-radius:50%; object-fit:cover;" />
<br/><b>Ananya Agarwal</b>
<br/><sub>Team Member</sub>
</td>

<td align="center" width="160">
<img src="https://github.com/user-attachments/assets/2f22ccfc-d1d9-4879-8a11-d738ba8f6e65"
width="120" height="120"
style="border-radius:50%; object-fit:cover;" />
<br/><b>Krishna Somani</b>
<br/><sub>Team Member</sub>
</td>

<td align="center" width="160">
<img src="https://github.com/user-attachments/assets/58ec2843-bdb7-4edf-9f10-be321bac6b63"
width="120" height="120"
style="border-radius:50%; object-fit:cover;" />
<br/><b>Praveen Kumar</b>
<br/><sub>Team Member</sub>
</td>

</tr>
</table>

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/colored.png" width="100%">

<div align="center">

<img src="https://readme-typing-svg.demolab.com?font=Syne&weight=700&size=15&pause=2000&color=38BDF8&center=true&vCenter=true&width=700&lines=Predict.+Protect.+Pay.+Instantly.;Built+for+the+backbone+of+India's+economy.;gigHood+%E2%80%94+Because+every+delivery+matters." alt="Footer Typing SVG"/>

<br/>

</div>