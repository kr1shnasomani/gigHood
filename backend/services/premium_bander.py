def calculate_premium(tier: str, avg_dci_4w: float, month: int) -> float:
    """
    Calculates the weekly premium based on risk Tier, historical DCI avg, and seasonality.
    
    Base Rates:
    - Tier A: ₹20 (DCI < 0.4) or ₹30 (DCI >= 0.4)
    - Tier B: ₹28 (DCI < 0.6) or ₹42 (DCI >= 0.6)
    - Tier C: ₹42 (DCI < 0.8) or ₹59 (DCI >= 0.8)
    
    Monsoon Multiplier:
    - 1.4x during monsoon months (June, July, August, September -> months 6, 7, 8, 9)
    """
    premium = 0.0
    
    # 1. Base rates based on documented product bounds
    # Tier A: ₹20 (low DCI < 0.4) or ₹28 (high DCI >= 0.4)
    # Tier B: ₹30 (low DCI < 0.6) or ₹42 (high DCI >= 0.6)
    # Tier C: ₹42 (low DCI < 0.8) or ₹59 (high DCI >= 0.8)
    if tier == 'A':
        premium = 28.0 if avg_dci_4w >= 0.4 else 20.0
    elif tier == 'B':
        premium = 42.0 if avg_dci_4w >= 0.6 else 30.0
    elif tier == 'C':
        premium = 59.0 if avg_dci_4w >= 0.8 else 42.0
    else:
        # Fallback to B default
        premium = 42.0 if avg_dci_4w >= 0.6 else 30.0
        
    # 2. Monsoon Multiplier check
    # Monsoon season is defined exactly as months 6 through 9 inclusive
    if month in [6, 7, 8, 9]:
        premium *= 1.4
        
    return round(premium, 2)
