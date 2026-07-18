from setuptools import setup, find_packages

setup(
    name="vaeloom-sdk",
    version="0.1.0",
    description="Vaeloom Python SDK — memory-first personal intelligence API client",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    python_requires=">=3.12",
    install_requires=["httpx>=0.27.0", "pydantic>=2.7.0"],
)
