import logging
from backend.config import settings

logger = logging.getLogger("premium_bander")


# =========================================================
# PREMIUM CALCULATOR
# =========================================================
def calculate_premium(tier: str, avg_dci_4w: float, month: int) -> float:
    """
    Production-grade premium calculation:
    - tier-based pricing
    - DCI-based adjustment
    - seasonal multiplier
    """

    try:
        # =========================================================
        # INPUT SANITY
        # =========================================================
        tier = tier.upper() if tier else "B"
        avg_dci_4w = max(0.0, min(avg_dci_4w, 1.0))  # clamp 0–1

        # =========================================================
        # BASE PRICING TABLE
        # =========================================================
        pricing = {
            "A": {
                "threshold": 0.4,
                "low": settings.PREMIUM_A_LOW,
                "high": settings.PREMIUM_A_HIGH,
            },
            "B": {
                "threshold": 0.6,
                "low": settings.PREMIUM_B_LOW,
                "high": settings.PREMIUM_B_HIGH,
            },
            "C": {
                "threshold": 0.8,
                "low": settings.PREMIUM_C_LOW,
                "high": settings.PREMIUM_C_HIGH,
            },
        }

        config = pricing.get(tier, pricing["B"])

        base_premium = (
            config["high"]
            if avg_dci_4w >= config["threshold"]
            else config["low"]
        )

        # =========================================================
        # SEASONAL MULTIPLIER
        # =========================================================
        if month in settings.MONSOON_MONTHS:
            base_premium *= settings.MONSOON_MULTIPLIER

        # =========================================================
        # FINAL CAP
        # =========================================================
        final_premium = max(
            settings.MIN_PREMIUM,
            min(base_premium, settings.MAX_PREMIUM)
        )

        final_premium = round(final_premium, 2)

        # =========================================================
        # LOGGING
        # =========================================================
        logger.info(
            f"[PREMIUM] tier={tier} dci={avg_dci_4w:.2f} "
            f"base={base_premium:.2f} final={final_premium}"
        )

        return final_premium

    except Exception:
        logger.error("Premium calculation failed", exc_info=True)
        return settings.MIN_PREMIUM