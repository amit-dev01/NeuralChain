"""
Markov chain for realistic Bitcoin transaction amount sequences.
States based on approximate BTC amount tiers.
"""

from enum import IntEnum
from typing import List, Optional

import numpy as np


class AmountState(IntEnum):
    MICRO = 0   # < 0.001 BTC
    DUST = 1    # 0.001 - 0.01
    SMALL = 2   # 0.01 - 0.1
    MEDIUM = 3  # 0.1 - 1.0
    LARGE = 4   # 1.0 - 10.0
    WHALE = 5   # > 10.0


# Transition matrix [from_state][to_state]
# Rows must sum to 1.0
TRANSITION_MATRIX = np.array([
    [0.50, 0.20, 0.15, 0.10, 0.04, 0.01],  # MICRO -> ...
    [0.20, 0.35, 0.25, 0.15, 0.04, 0.01],  # DUST  -> ...
    [0.10, 0.15, 0.40, 0.25, 0.08, 0.02],  # SMALL -> ...
    [0.05, 0.08, 0.20, 0.42, 0.20, 0.05],  # MEDIUM-> ...
    [0.02, 0.03, 0.10, 0.25, 0.45, 0.15],  # LARGE -> ...
    [0.01, 0.02, 0.05, 0.15, 0.32, 0.45],  # WHALE -> ...
])

STATE_RANGES = {
    AmountState.MICRO:  (0.00001, 0.001),
    AmountState.DUST:   (0.001, 0.01),
    AmountState.SMALL:  (0.01, 0.1),
    AmountState.MEDIUM: (0.1, 1.0),
    AmountState.LARGE:  (1.0, 10.0),
    AmountState.WHALE:  (10.0, 500.0),
}


class MarkovAmountGenerator:
    """
    Simulates realistic Bitcoin transaction transfer volume sequences
    using an empirical 6-tier Markov state transition matrix.
    """

    def __init__(
        self,
        initial_state: AmountState = AmountState.SMALL,
        seed: Optional[int] = None,
    ):
        self.current_state = initial_state
        self.rng = np.random.default_rng(seed)

    def next_amount(self) -> float:
        """Generate next amount and transition state."""
        row = TRANSITION_MATRIX[self.current_state]
        self.current_state = int(self.rng.choice(len(AmountState), p=row))
        lo, hi = STATE_RANGES[AmountState(self.current_state)]
        # Log-uniform sampling within range
        log_lo, log_hi = np.log(lo), np.log(hi)
        return float(np.exp(self.rng.uniform(log_lo, log_hi)))

    def generate_sequence(self, n: int) -> List[float]:
        """Generate a sequential chain of n realistic transaction amounts."""
        return [self.next_amount() for _ in range(n)]

    def get_round_amount(self) -> float:
        """Returns a round BTC amount (ransomware pattern)."""
        choices = [0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]
        return float(self.rng.choice(choices))
