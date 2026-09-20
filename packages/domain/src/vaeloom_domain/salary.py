from pydantic import BaseModel, Field


class SalaryBenchmark(BaseModel):
    role: str
    location: str
    p25: int
    median: int
    p75: int
    p90: int
    currency: str = "USD"


BENCHMARKS = {
    "software_engineer": {"p25": 110000, "median": 140000, "p75": 175000, "p90": 210000},
    "senior_software_engineer": {"p25": 150000, "median": 185000, "p75": 225000, "p90": 270000},
    "staff_software_engineer": {"p25": 190000, "median": 235000, "p75": 290000, "p90": 350000},
    "product_manager": {"p25": 115000, "median": 145000, "p75": 180000, "p90": 220000},
}


def estimate_salary_benchmark(role: str, location: str = "US_REMOTE") -> SalaryBenchmark:
    """Deterministic compensation estimation based on standard industry benchmark tables."""
    key = role.lower().strip().replace(" ", "_")
    data = BENCHMARKS.get(key, {"p25": 90000, "median": 120000, "p75": 150000, "p90": 180000})

    return SalaryBenchmark(
        role=role,
        location=location,
        p25=data["p25"],
        median=data["median"],
        p75=data["p75"],
        p90=data["p90"],
    )
