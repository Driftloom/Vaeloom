"""
Vaeloom Domain Mock Datasets: Resumes, Job Postings, ATS Gazetteers, and Salary Benchmarks.
"""

SAMPLE_CANDIDATE = {
    "id": "cand_alex_mercer_01",
    "name": "Alex Mercer",
    "email": "alex.mercer@vaeloom.test",
    "title": "Senior Distributed Systems Engineer",
    "summary": "Distributed systems engineer with 8+ years experience designing fault-tolerant consensus architectures, Raft/Paxos state machines, and high-throughput low-latency network primitives in Rust and Go.",
    "skills": ["Rust", "Go", "Distributed Consensus", "Raft", "Paxos", "Kubernetes", "gRPC", "PostgreSQL", "Kafka", "Linux eBPF"],
    "experience": [
        {
            "title": "Senior Staff Systems Engineer",
            "company": "Apex Cloud Systems",
            "period": "03/2022 - Present",
            "highlights": [
                "Architected a globally distributed Raft replication engine processing 1.2M transactions/sec with sub-5ms P99 latency.",
                "Engineered zero-copy network buffers using eBPF, slashing cross-datacenter ingress bandwidth costs by 38%.",
                "Mentored a team of 12 distributed systems engineers across 3 geographic timezones."
            ]
        },
        {
            "title": "Backend Infrastructure Engineer",
            "company": "Helios Data Labs",
            "period": "06/2018 - 02/2022",
            "highlights": [
                "Built asynchronous streaming ingestion pipelines handling 50TB daily telemetry with Apache Kafka and Go.",
                "Reduced deployment downtime from 45 minutes to 0 seconds via blue-green Kubernetes release workflows."
            ]
        }
    ],
    "education": [
        {
            "degree": "B.S. Computer Science",
            "institution": "University of California, Berkeley",
            "year": "2018"
        }
    ]
}

VAELOOM_JOB_POSTINGS = [
    {
        "id": "job_cloudflare_staff_01",
        "title": "Staff Distributed Systems Engineer",
        "company": "Cloudflare",
        "department": "Core Edge Infrastructure",
        "location": "San Francisco, CA (Hybrid)",
        "salary_range": "$220,000 - $280,000",
        "equity": "0.15% - 0.25%",
        "target_level": "L6 / Staff",
        "required_skills": ["Rust", "Go", "Distributed Consensus", "Raft", "Paxos", "Linux Kernel / eBPF", "High-throughput edge routing"],
        "description": "We are seeking a Staff Distributed Systems Engineer to scale our global edge network. You will design next-generation state replication protocols across 300+ datacenters.",
    },
    {
        "id": "job_anthropic_agent_arch_02",
        "title": "Member of Technical Staff, Agent Architectures",
        "company": "Anthropic",
        "department": "Frontier Agent Systems",
        "location": "San Francisco, CA",
        "salary_range": "$260,000 - $340,000",
        "equity": "High Equity Grant",
        "target_level": "Senior / Staff",
        "required_skills": ["Claude Messages API", "Multi-Agent Orchestration", "ReAct Loops", "Prompt Caching", "Zero-Trust Security", "Python 3.12"],
        "description": "Build production multi-agent architectures that govern autonomous reasoning loops, tool dispatch, and verification safeguards at frontier scale.",
    },
    {
        "id": "job_stripe_staff_infra_03",
        "title": "Staff Infrastructure Reliability Engineer",
        "company": "Stripe",
        "department": "Global Financial Infrastructure",
        "location": "Seattle, WA / Remote",
        "salary_range": "$230,000 - $290,000",
        "equity": "RSU Package",
        "target_level": "L6",
        "required_skills": ["High Availability", "PostgreSQL Sharding", "Distributed Tracing", "Zero-Downtime DR", "Python", "Go"],
        "description": "Ensure 99.999% global financial payment availability. Lead disaster recovery drills, automated cell failovers, and low-latency transactional pipelines.",
    }
]

SALARY_BENCHMARKS = {
    "Staff Distributed Systems Engineer": {
        "San Francisco, CA": {"p25": 215000, "p50": 248000, "p75": 285000, "p90": 325000},
        "New York, NY": {"p25": 205000, "p50": 238000, "p75": 272000, "p90": 310000},
        "Remote (US)": {"p25": 195000, "p50": 225000, "p75": 260000, "p90": 295000},
    },
    "Member of Technical Staff, Agent Architectures": {
        "San Francisco, CA": {"p25": 250000, "p50": 295000, "p75": 345000, "p90": 410000},
    }
}

CAREER_JOBS = VAELOOM_JOB_POSTINGS

