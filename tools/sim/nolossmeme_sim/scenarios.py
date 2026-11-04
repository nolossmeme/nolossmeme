"""Community scenarios used in the README."""

from .model import Scenario

SCENARIOS: list[Scenario] = [
    Scenario(name="quiet", initial_depositors=20, joins_per_day=0.2, exits_per_day=0.1, checkin_rate=0.2),
    Scenario(name="steady", initial_depositors=50, joins_per_day=1.0, exits_per_day=0.3, checkin_rate=0.5),
    Scenario(name="viral", initial_depositors=50, joins_per_day=8.0, exits_per_day=0.5, checkin_rate=0.7),
    Scenario(name="rugpull-attempt", initial_depositors=200, joins_per_day=0.0, exits_per_day=15.0, checkin_rate=0.3),
]
