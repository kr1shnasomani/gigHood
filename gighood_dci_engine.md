### 🧠 The Anatomy of the DCI Engine
Traditional insurance relies on subjective human investigation. gigHood replaces this with the **Demand Collapse Index (DCI)**—a deterministic, mathematically rigorous engine that measures true economic disruption rather than just weather proxies. 

The DCI calculates real-time risk at a hyper-local (H3 Hex) resolution by aggregating independent external signals into a single, normalized disruption score.

#### The 4 Independent Parametric Signals
Our engine continuously ingests telemetry from verifiable external oracles across four dimensions:
* **$W$ (Environmental / Weather):** Heavy rainfall ($\geq 35$mm/hr), severe wind, or hazardous Air Quality (AQI $> 300$ via CPCB).
* **$T$ (Traffic Gridlock):** Severe localized congestion preventing active delivery movement.
* **$P$ (Platform Reliability):** Aggregator network latency or sudden drop in API volume indicating a local dark store shutdown.
* **$S$ (Social Disruption):** Localized curfews, strikes, or civic blockades.

#### The Mathematical Formula
To prevent false positives and isolate true disruption, the raw signals are processed through a weighted composite formula:

$$\text{DCI} = \sigma(\alpha W + \beta T + \gamma P + \delta S)$$

* **The Inputs ($W, T, P, S$):** Each signal is normalized to a severity score between 0.0 and 1.0.
* **The Weights ($\alpha, \beta, \gamma, \delta$):** These are our dynamically calibrated coefficients. They ensure that a massive 120mm/hr flood ($W$) carries more weight than a minor traffic jam ($T$).
* **The Sigmoid Function ($\sigma$):** We pass the weighted sum through a sigmoid activation function, $\sigma(x) = \frac{1}{1 + e^{-x}}$. This guarantees the final DCI score is strictly bounded between 0.00 and 1.00, providing a clean, auditable metric for our underwriting pool.

#### The Threshold Logic (Zero-Touch Payouts)
The resulting DCI composite score dictates the automated state of the specific municipal hex zone:
* 🟢 **Normal ($\text{DCI} \leq 0.65$):** Standard operations. No payouts authorized.
* 🟡 **Elevated Watch ($0.65 < \text{DCI} \leq 0.85$):** Risk is high. Worker apps update to display an amber warning, but the threshold for economic collapse is not yet met.
* 🔴 **Automated Claim ($\text{DCI} > 0.85$):** The zone has suffered a verifiable demand collapse. The system automatically triggers the zero-touch settlement pipeline, verifying worker GPS location and executing UPI payouts instantly.