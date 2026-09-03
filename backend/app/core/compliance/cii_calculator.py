"""IMO Carbon Intensity Indicator: attained value, required value and rating.

    CO2       = sum_f (m_f * CF_f)
    AER       = CO2 / (Capacity * Distance)          [gCO2 / (t.nm)]
    CII_ref   = a * Capacity^(-c)                    [MEPC.353(78)]
    CII_req   = CII_ref * (1 - Z/100)                [MEPC.338(76)]
    rating    = compare AER against dd1..dd4 * CII_req

A rating of D for three consecutive years, or a single E, obliges the operator
to file a corrective action plan under SEEMP Part III. That is why CII belongs
inside the optimizer as a constraint rather than in a report afterwards.
"""

from __future__ import annotations

from dataclasses import dataclass, asdict

from ..physics.fuel_conversion import get_fuel
from .imo_rules import get_ship_type, rating_boundaries, reduction_factor


@dataclass
class CIIResult:
    attained_cii: float
    required_cii: float
    reference_cii: float
    rating: str
    rating_description: str
    co2_emissions_t: float
    capacity_dwt: float
    distance_nm: float
    year: int
    reduction_factor_z: float
    boundaries: dict
    margin_to_required_pct: float
    margin_to_c_boundary_pct: float
    is_compliant: bool

    def to_dict(self) -> dict:
        out = asdict(self)
        for key, value in out.items():
            if isinstance(value, float):
                out[key] = round(value, 6)
        return out


def reference_cii(ship_type_id: str, capacity_dwt: float) -> float:
    """CII_ref = a * Capacity^(-c), honouring per-type capacity thresholds."""
    spec = get_ship_type(ship_type_id)
    capacity = float(capacity_dwt)

    cap = spec.get("capacity_cap")
    if cap is not None:
        capacity = min(capacity, float(cap))

    threshold = spec.get("capacity_threshold")
    if threshold is not None and capacity < float(threshold):
        a = float(spec["a_below"])
        c = float(spec["c_below"])
    else:
        a = float(spec["a"])
        c = float(spec["c"])

    return a * (capacity ** (-c))


def required_cii(ship_type_id: str, capacity_dwt: float, year: int) -> float:
    z = reduction_factor(year)
    return reference_cii(ship_type_id, capacity_dwt) * (1.0 - z / 100.0)


def attained_aer(co2_emissions_t: float, capacity_dwt: float, distance_nm: float) -> float:
    """AER in gCO2 per tonne-nautical-mile."""
    denominator = max(capacity_dwt * distance_nm, 1e-9)
    return (co2_emissions_t * 1e6) / denominator


def co2_from_fuel_mix(fuel_mix: dict[str, float]) -> float:
    """Total CO2 in tonnes from {fuel_id: mass_tonnes}, using IMO carbon factors."""
    return sum(mass_t * float(get_fuel(fid)["cf_tco2_per_tfuel"])
               for fid, mass_t in fuel_mix.items())


def classify_rating(attained: float, required: float, ship_type_id: str) -> tuple[str, dict]:
    """Map an attained CII onto the A-E band via the dd boundaries."""
    dd = rating_boundaries(ship_type_id)
    bounds = {
        "A_upper": required * dd[0],
        "B_upper": required * dd[1],
        "C_upper": required * dd[2],
        "D_upper": required * dd[3],
    }
    if attained <= bounds["A_upper"]:
        rating = "A"
    elif attained <= bounds["B_upper"]:
        rating = "B"
    elif attained <= bounds["C_upper"]:
        rating = "C"
    elif attained <= bounds["D_upper"]:
        rating = "D"
    else:
        rating = "E"
    return rating, bounds


def calculate_cii(ship_type_id: str, capacity_dwt: float, distance_nm: float,
                  fuel_mix: dict[str, float], year: int = 2026) -> CIIResult:
    """Complete CII assessment for a voyage or an annual aggregate."""
    from .imo_rules import rating_labels

    co2_t = co2_from_fuel_mix(fuel_mix)
    attained = attained_aer(co2_t, capacity_dwt, distance_nm)
    ref = reference_cii(ship_type_id, capacity_dwt)
    req = required_cii(ship_type_id, capacity_dwt, year)
    rating, bounds = classify_rating(attained, req, ship_type_id)

    labels = rating_labels()
    # Compliance in the regulatory sense means not sitting in D (repeatedly) or E;
    # the operative target is to stay at or below the C upper boundary.
    c_upper = bounds["C_upper"]

    return CIIResult(
        attained_cii=attained,
        required_cii=req,
        reference_cii=ref,
        rating=rating,
        rating_description=labels[rating]["description"],
        co2_emissions_t=co2_t,
        capacity_dwt=capacity_dwt,
        distance_nm=distance_nm,
        year=year,
        reduction_factor_z=reduction_factor(year),
        boundaries=bounds,
        margin_to_required_pct=(req - attained) / max(req, 1e-9) * 100.0,
        margin_to_c_boundary_pct=(c_upper - attained) / max(c_upper, 1e-9) * 100.0,
        is_compliant=attained <= c_upper,
    )
