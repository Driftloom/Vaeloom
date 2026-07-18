# Vaeloom local/dev Postgres image: PostgreSQL 16 with pgvector + Apache AGE.
# pgvector is provided by the base image; Apache AGE (graph) is built from source.
# See Docs/Database/Schema.md, Docs/AI/Knowledge-Graph.md, Docs/AI/Embeddings.md
FROM pgvector/pgvector:pg16

ARG AGE_VERSION=PG16/v1.5.0-rc0

RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
        build-essential git ca-certificates flex bison \
        postgresql-server-dev-16; \
    git clone --depth 1 --branch "${AGE_VERSION}" https://github.com/apache/age.git /tmp/age; \
    cd /tmp/age; \
    make PG_CONFIG=/usr/bin/pg_config; \
    make install PG_CONFIG=/usr/bin/pg_config; \
    cd /; rm -rf /tmp/age; \
    apt-get purge -y --auto-remove build-essential git flex bison postgresql-server-dev-16; \
    rm -rf /var/lib/apt/lists/*

# AGE must be preloaded so the extension can be created and graph functions resolve.
RUN echo "shared_preload_libraries = 'age'" >> /usr/share/postgresql/postgresql.conf.sample

COPY init/ /docker-entrypoint-initdb.d/
