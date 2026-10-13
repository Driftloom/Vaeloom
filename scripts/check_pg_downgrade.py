#!/usr/bin/env python3
"""Preflight: would ``alembic downgrade`` across 0069/0068 refuse, and on what?

0068 and 0069 each retire a *frozen* 24-literal memory vocabulary, and each puts
it back in ``downgrade()``. PostgreSQL validates an ``ADD CONSTRAINT`` against
every existing row, so once a second domain pack has written a type the CHECK does
not list, the downgrade correctly refuses -- and it says only ``violated by some
row``, with no DETAIL naming the value. Both migrations log their own pre-restore
evidence for exactly that reason.

A refusal is a *correct* result: the rows in the way are legitimate data under the
domain-pack registry. This script exists so an operator learns that before running
the downgrade, because the nearest documented response to a refusal -- restore from
a pre-deployment backup -- destroys the very data that caused it.

Read-only by construction and by verification: every statement runs inside an
explicit ``BEGIN READ ONLY``, and ``SHOW transaction_read_only`` is required to
answer ``on`` before any other statement is issued. That check is not ceremony --
a hosted pooler can strip the setting, and a preflight that silently became a
writer would be worse than no preflight. Unlike ``verify_pg_migrations.py`` there
is deliberately no ``_proof``/``_test`` database-name guard: inspecting production
*before* a rollback is this script's entire purpose, so the verified read-only
transaction is what compensates.

The two vocabularies are read out of the migration modules, never restated here.
A fourth copy of the 24 literals would be exactly the drift 0069 removed.

Exit codes:
    0  neither downgrade would refuse on the data this session can see
    1  at least one would; the offending values are named in the report
    2  could not determine (no URL, read-only verification failed, query failed)
"""

from __future__ import annotations

import argparse
import asyncio
import dataclasses
import importlib.util
import json
import os
import pathlib
import re
import sys
from collections.abc import Mapping, Sequence
from urllib.parse import urlsplit

# scripts/check_pg_downgrade.py -> repo root
REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent

VERSIONS_DIR = REPO_ROOT / "apps" / "api" / "alembic" / "versions"

# The URL the migrations themselves run against. Not VAELOOM_TEST_PG_URL: that names
# a disposable verification database, whose memory tables are empty, so nothing ever
# refuses there and the preflight would report a green that means nothing.
TARGET_URL_ENV_VAR = "VAELOOM_TARGET_URL"

_SQL_IDENTIFIER = re.compile(r"[A-Za-z_][A-Za-z0-9_]*")

# Any URL-shaped run of userinfo, in a driver message as likely as in an argv. This
# script never prints the URL itself, but a connection error quotes the DSN back.
_URL_CREDENTIALS = re.compile(r"(?P<scheme>[A-Za-z0-9+]+://)(?P<userinfo>[^/@\s]+)@")


class PreflightError(RuntimeError):
    """Refused or undeterminable. The answer is "no idea", never a guess."""


class ReadOnlyNotVerified(PreflightError):
    """BEGIN READ ONLY did not survive to the first query."""


@dataclasses.dataclass(frozen=True)
class FrozenVocabulary:
    """One downgrade's reinstated vocabulary, read from the migration that reinstates it."""

    revision: str
    table: str
    constraint: str
    types: tuple[str, ...]


@dataclasses.dataclass(frozen=True)
class DowngradeContract:
    """Everything this preflight reads out of the migration modules, in one pass."""

    vocabularies: tuple[FrozenVocabulary, ...]
    packs_table: str
    feedback_table: str


@dataclasses.dataclass(frozen=True)
class TableReport:
    """What one table holds against the vocabulary its downgrade would restore."""

    vocabulary: FrozenVocabulary
    present: Mapping[str, int]
    offending: Mapping[str, int]
    null_type_rows: int = 0

    @property
    def would_refuse(self) -> bool:
        return bool(self.offending)


@dataclasses.dataclass(frozen=True)
class PackRow:
    slug: str
    version: int
    types: tuple[str, ...]


@dataclasses.dataclass(frozen=True)
class Preflight:
    target: str
    reports: tuple[TableReport, ...]
    packs: tuple[PackRow, ...]
    quarantined_feedback: int | None
    rls_note: str | None

    @property
    def would_refuse(self) -> bool:
        return any(report.would_refuse for report in self.reports)


@dataclasses.dataclass(frozen=True)
class _Query:
    """One SELECT, keyed so the caller can name what it is unpacking.

    The key rather than a positional unpack: the sibling script's fixed-width tuple
    unpack already shifted once when a statement was added mid-list, silently
    reinterpreting every count after it.
    """

    key: str
    sql: str
    parameters: Mapping[str, object] = dataclasses.field(default_factory=dict)


# --------------------------------------------------------------------------
# Reading the vocabularies out of the migrations
# --------------------------------------------------------------------------


def _load_migration(filename: str):
    """Import one alembic version script by path.

    The ``sys.modules`` entry is required *before* ``exec_module``, not added after.
    ``dataclasses._is_type`` resolves string annotations through
    ``sys.modules[cls.__module__]``; with the module unregistered that lookup is
    ``None`` and any ``@dataclass`` in the file raises ``AttributeError: 'NoneType'
    object has no attribute '__dict__'``. This is the importlib recipe in
    ``tests/test_verify_pg_migrations_script.py:44-53``, and it is here for the same
    reason whatever 0068 and 0069 happen to declare.
    """
    path = VERSIONS_DIR / filename
    if not path.is_file():
        raise PreflightError(
            f"the migration {filename} is not at {path.as_posix()}, so the frozen "
            "vocabulary it restores on downgrade cannot be read. Reporting a refusal "
            "-- or its absence -- without it would be about the wrong database."
        )
    spec = importlib.util.spec_from_file_location(f"_check_pg_downgrade_{path.stem}", path)
    if spec is None or spec.loader is None:  # pragma: no cover - a loader is always present
        raise PreflightError(f"the migration {path.as_posix()} could not be loaded.")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def _literals_from_check_sql(check_sql: str, source: str) -> tuple[str, ...]:
    """Pull the quoted literals out of a ``CHECK (type IN (...))`` body.

    Read rather than restated so a fourth copy of the vocabulary cannot exist. The
    slice stops at the first ``)`` after ``type IN (``: the literal list has no
    nesting, which is what makes this cheaper than a paren-matching walk and why the
    migration's own formatting stays the only thing that could break it.
    """
    marker = "type IN ("
    try:
        start = check_sql.index(marker) + len(marker)
        end = check_sql.index(")", start)
    except ValueError as exc:
        raise PreflightError(
            f"could not find a `type IN (...)` literal list in {source}, so the "
            "vocabulary its downgrade restores is unknown. Refusing to guess: an empty "
            "vocabulary would call every row offending, and a mis-parsed one would "
            "call none."
        ) from exc
    return tuple(re.findall(r"'([^']+)'", check_sql[start:end]))


def downgrade_contract() -> DowngradeContract:
    """The two vocabularies 0069/0068 reinstate, plus the other tables read beside them.

    0068 writes its vocabulary down as an f-string DDL literal and 0069 as a Python
    tuple, because that is how each migration chose to write it. Both are read where
    they are written.
    """
    module_0068 = _load_migration("0068_memory_type_packs.py")
    module_0069 = _load_migration("0069_memory_workspace_isolation.py")

    return DowngradeContract(
        vocabularies=(
            FrozenVocabulary(
                revision=module_0068.revision,
                table=module_0068._MEMORY,
                constraint=module_0068._CHECK,
                types=_literals_from_check_sql(
                    module_0068._CHECK_SQL, "0068_memory_type_packs"
                ),
            ),
            FrozenVocabulary(
                revision=module_0069.revision,
                table=module_0069._MEMORY_RECORDS,
                constraint=module_0069._CHECK,
                types=tuple(module_0069._FROZEN_TYPES),
            ),
        ),
        packs_table=module_0068._TABLE,
        feedback_table=module_0069._FEEDBACK,
    )


def frozen_vocabularies() -> tuple[FrozenVocabulary, ...]:
    """The reinstated vocabularies alone, for callers that need nothing else."""
    return downgrade_contract().vocabularies


# --------------------------------------------------------------------------
# Talking to the database, read-only and verified
# --------------------------------------------------------------------------


def _text(statement: str):
    """``sa.text`` kept in one place so the lazy sqlalchemy import happens once."""
    import sqlalchemy as sa

    return sa.text(statement)


def _async_url(url: str) -> str:
    """Pin the asyncpg driver whichever form the operator supplied."""
    if url.startswith("postgresql+asyncpg://"):
        return url
    if url.startswith("postgresql://"):
        return "postgresql+asyncpg://" + url[len("postgresql://") :]
    return url


def _create_engine(url: str):
    """An engine that opens no transaction of its own.

    ``AUTOCOMMIT`` is load-bearing rather than a preference: SQLAlchemy begins a
    transaction before the first statement, and a ``BEGIN READ ONLY`` issued inside
    one it had already opened would nest -- leaving ``SHOW transaction_read_only``
    describing the outer transaction rather than the one these queries ran in.
    """
    from sqlalchemy.ext.asyncio import create_async_engine
    from sqlalchemy.pool import NullPool

    return create_async_engine(
        _async_url(url), poolclass=NullPool, isolation_level="AUTOCOMMIT"
    )


def _assert_read_only(setting: object) -> None:
    """Require the server to agree that this transaction cannot write.

    Checked rather than assumed because the assumption is known to fail in this repo:
    a hosted pooler has been observed to strip the setting. Queries run from an
    unverified "read-only" transaction are reported from a state nobody can vouch
    for, which is the one outcome a preflight must not produce.
    """
    if str(setting).strip().lower() != "on":
        raise ReadOnlyNotVerified(
            f"BEGIN READ ONLY did not take: SHOW transaction_read_only answered "
            f"{setting!r}, not 'on'. A pooler or a proxy can strip the setting, so it "
            "is verified rather than assumed. Refusing to inspect the database rather "
            "than run queries whose read-only-ness nobody can vouch for."
        )


async def _fetch_all(connection, statement: str, parameters: Mapping[str, object]) -> list[tuple]:
    result = await connection.execute(_text(statement), parameters)
    return [tuple(row) for row in result.fetchall()]


async def _run_read_only_async(url: str, queries: Sequence[_Query]) -> list[list[tuple]]:
    engine = _create_engine(url)
    try:
        async with engine.connect() as connection:
            await connection.execute(_text("BEGIN READ ONLY"))
            read_only = (
                await _fetch_all(connection, "SHOW transaction_read_only", {})
            )[0][0]
            _assert_read_only(read_only)
            results = [
                await _fetch_all(connection, query.sql, query.parameters) for query in queries
            ]
            await connection.execute(_text("COMMIT"))
            return results
    finally:
        await engine.dispose()


def _run_read_only(url: str, queries: Sequence[_Query]) -> list[list[tuple]]:
    """Run every statement in one verified ``BEGIN READ ONLY``, or raise.

    The read-only transaction is opened and verified here, per call, rather than once
    around the whole run: :func:`_schema_presence` needs its own, and a caller that
    trusted an outer verification would be trusting a flag this module sets itself.
    """
    try:
        return asyncio.run(_run_read_only_async(url, queries))
    except PreflightError:
        raise
    # Every driver failure is a "cannot determine", not a verdict: a connection
    # refused, a permission denied and a missing role all mean this script could not
    # answer, and answering 0 for any of them would be the worst thing it could do.
    except Exception as exc:
        raise PreflightError(
            f"the read-only inspection failed: {type(exc).__name__}: {exc}"
        ) from exc


# --------------------------------------------------------------------------
# Queries
# --------------------------------------------------------------------------


def _sql_identifier(name: str) -> str:
    """Accept a bare identifier for interpolation, or refuse.

    Table names reach SQL by interpolation because PostgreSQL has no placeholder for
    them. They are read from the migration modules rather than typed here, but a
    parser bug or a tampered file is still a path by which arbitrary SQL would arrive,
    so the whole identifier is checked rather than trusted.
    """
    if not _SQL_IDENTIFIER.fullmatch(name):
        raise PreflightError(
            f"refusing to run: {name!r} is not a usable PostgreSQL identifier, so it "
            "cannot be interpolated into a query safely."
        )
    return name


def _sql_string(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def _type_counts_query(table: str) -> str:
    # type::text so the value comes back as a Python string whatever the column type
    # is on this deployment, and so it can be compared against the frozen tuple
    # directly. NULL is grouped rather than filtered: `NULL IN (...)` is not false, so
    # the restored CHECK accepts a NULL type and it can never be why a downgrade refuses.
    return f"SELECT type::text, count(*) FROM {_sql_identifier(table)} GROUP BY 1 ORDER BY 1"


def _schema_presence(url: str, contract: DowngradeContract) -> dict[str, bool]:
    """Whether the tables, and the 0069 column, this preflight reads actually exist.

    Its own read-only transaction, so the data queries need no ``IF EXISTS``
    decoration on any of them. A missing table is a hard error rather than "nothing
    found": "the table is empty" and "the table is not there" both render as a green
    preflight, and only the first is a real answer.
    """
    names = [vocabulary.table for vocabulary in contract.vocabularies] + [
        contract.packs_table
    ]
    # One SELECT for every relation rather than one per relation: the identifiers
    # have already been validated, and a preflight should not need three verified
    # read-only transactions to decide whether the tables are there at all.
    values = ", ".join(f"({_sql_string(_sql_identifier(name))})" for name in names)
    relation_rows, column_rows = _run_read_only(
        url,
        [
            _Query(
                "relations",
                "SELECT r.name, to_regclass('public.' || r.name) IS NOT NULL "
                f"FROM (VALUES {values}) AS r(name)",
            ),
            _Query(
                "feedback_column",
                "SELECT count(*) FROM information_schema.columns "
                " WHERE table_schema = 'public' AND table_name = :feedback "
                "   AND column_name = 'workspace_id'",
                {"feedback": contract.feedback_table},
            ),
        ],
    )

    present = {str(row[0]): row[1] is True for row in relation_rows}
    missing = sorted(name for name, exists in present.items() if not exists)
    if missing:
        raise PreflightError(
            f"the target database has no {', '.join(missing)}. It is not at the revision "
            "these downgrades roll back from, so whether they would refuse is not a "
            f"question this database can answer. Point --pg-url (or ${TARGET_URL_ENV_VAR}) "
            "at the database alembic migrated, not at a disposable one."
        )
    # Not fatal, unlike the relations above: 0069's own column is legitimately absent
    # when 0069 has not been applied, and the report says so rather than refusing.
    present[f"{contract.feedback_table}.workspace_id"] = bool(column_rows[0][0])
    return present


def _packs_query(packs_table: str) -> str:
    # types::text because the column is JSONB and this reads it as the document it
    # is; it is parsed below rather than trusted to the driver's type inference.
    return (
        f"SELECT slug::text, version, types::text FROM {_sql_identifier(packs_table)} "
        "WHERE is_active ORDER BY slug"
    )


def _rls_probe_queries(vocabularies: Sequence[FrozenVocabulary]) -> list[_Query]:
    """Whether these tables hide rows, and whether this session can see past them.

    ``memories`` is FORCE-RLS with only a workspace-scoped policy, and an unset
    ``app.workspace_id`` GUC makes that predicate NULL -- zero rows, *no error*. A
    preflight run that way would report "would not refuse" about data it never saw.
    """
    names = ", ".join(
        _sql_string(_sql_identifier(vocabulary.table)) for vocabulary in vocabularies
    )
    return [
        _Query(
            "rls_flags",
            "SELECT c.relname, c.relforcerowsecurity FROM pg_class c "
            " JOIN pg_namespace n ON n.oid = c.relnamespace "
            f"WHERE n.nspname = 'public' AND c.relname IN ({names})",
        ),
        _Query(
            "session_role",
            "SELECT r.rolsuper, r.rolbypassrls FROM pg_roles r WHERE r.rolname = current_user",
        ),
    ]


# --------------------------------------------------------------------------
# Collection
# --------------------------------------------------------------------------


def collect_preflight(url: str, contract: DowngradeContract) -> Preflight:
    """Read the database, read-only, and answer whether the downgrades would refuse."""
    presence = _schema_presence(url, contract)
    feedback_column = f"{contract.feedback_table}.workspace_id"

    queries: list[_Query] = [
        *_rls_probe_queries(contract.vocabularies),
        *[
            _Query(
                f"types:{vocabulary.table}",
                _type_counts_query(vocabulary.table),
            )
            for vocabulary in contract.vocabularies
        ],
        _Query("packs", _packs_query(contract.packs_table)),
    ]
    if presence[feedback_column]:
        queries.append(
            _Query(
                "feedback_null_workspace",
                f"SELECT count(*) FROM {_sql_identifier(contract.feedback_table)} "
                "WHERE workspace_id IS NULL",
            )
        )

    results = {
        query.key: rows
        for query, rows in zip(queries, _run_read_only(url, queries), strict=True)
    }

    reports = []
    for vocabulary in contract.vocabularies:
        counts = results[f"types:{vocabulary.table}"]
        present = {str(row[0]): int(row[1]) for row in counts if row[0] is not None}
        reports.append(
            TableReport(
                vocabulary=vocabulary,
                present=present,
                offending={
                    value: count
                    for value, count in present.items()
                    if value not in vocabulary.types
                },
                null_type_rows=sum(int(row[1]) for row in counts if row[0] is None),
            )
        )

    packs = []
    for slug, version, raw_types in results["packs"]:
        try:
            declared = json.loads(raw_types)
        except (TypeError, ValueError) as exc:
            raise PreflightError(
                f"the {contract.packs_table} row '{slug}' has a types column this "
                f"preflight cannot read ({exc}). Its contents are what makes a second "
                "vocabulary possible, so they are reported rather than skipped."
            ) from exc
        packs.append(PackRow(slug=str(slug), version=int(version), types=tuple(declared)))

    return Preflight(
        target=describe_target(url),
        reports=tuple(reports),
        packs=tuple(packs),
        quarantined_feedback=(
            int(results["feedback_null_workspace"][0][0])
            if "feedback_null_workspace" in results
            else None
        ),
        rls_note=_rls_note(results),
    )


def _rls_note(results: Mapping[str, list[tuple]]) -> str | None:
    """Warn when this session cannot see every row it is judging."""
    role = results["session_role"][0] if results["session_role"] else None
    if role is not None and (role[0] is True or role[1] is True):
        return None
    forced = sorted(str(row[0]) for row in results["rls_flags"] if row[1] is True)
    if not forced:
        return None
    who = (
        "this session's role could not be read from pg_roles"
        if role is None
        else "this session is neither superuser nor BYPASSRLS"
    )
    return (
        f"{who}, and {', '.join(forced)} is FORCE ROW LEVEL SECURITY. With "
        "app.workspace_id unset the policy evaluates to NULL and the table reads as "
        "zero rows -- no error. Treat a 'would not refuse' verdict from this role as "
        "'no offending rows were visible'; re-run as the migrator role to be sure."
    )


# --------------------------------------------------------------------------
# Reporting
# --------------------------------------------------------------------------


def describe_target(url: str) -> str:
    """``host:port/database`` -- never the userinfo, never the query string."""
    parts = urlsplit(url)
    host = parts.hostname or ""
    if parts.port:
        host = f"{host}:{parts.port}"
    database = parts.path.lstrip("/")
    return f"{host}/{database}" if database else host


def redact(message: str) -> str:
    """Strip userinfo out of anything URL-shaped before it is printed.

    This script never prints the URL, but a driver's connection error quotes the DSN
    back, and this is a script whose whole point is being safe to point at production.
    """
    return _URL_CREDENTIALS.sub(lambda match: f"{match.group('scheme')}***@", message)


def _population(present: Mapping[str, int]) -> str:
    if not present:
        return "none -- the table is empty"
    return ", ".join(f"{value} ({count})" for value, count in sorted(present.items()))


def render(preflight: Preflight) -> str:
    """The operator-facing report. Names every offending value it found."""
    lines = [
        "memory downgrade preflight (read-only)",
        f"target: {preflight.target}",
        "every statement ran inside BEGIN READ ONLY; transaction_read_only = on",
        "",
    ]

    for report in preflight.reports:
        vocabulary = report.vocabulary
        lines.append(
            f"{vocabulary.table}  --  {vocabulary.revision}'s downgrade reinstates "
            f"{vocabulary.constraint} ({len(vocabulary.types)} literals)"
        )
        lines.append(f"  distinct types present: {_population(report.present)}")
        if report.offending:
            lines.append(
                "  outside the frozen vocabulary: "
                + ", ".join(
                    f"{value} ({count} rows)" for value, count in sorted(report.offending.items())
                )
            )
            lines.append(
                f"  => {vocabulary.revision}'s downgrade WOULD REFUSE. PostgreSQL will "
                f"report `{vocabulary.constraint} is violated by some row`, with no "
                "DETAIL naming the value."
            )
        else:
            lines.append("  outside the frozen vocabulary: none")
            lines.append(
                f"  => {vocabulary.revision}'s downgrade would not refuse on this table."
            )
        if report.null_type_rows:
            lines.append(
                f"  {report.null_type_rows} row(s) have a NULL type. The restored CHECK "
                "accepts those -- `NULL IN (...)` is not false -- so they are not counted "
                "as offending."
            )
        lines.append("")

    frozen = {value for report in preflight.reports for value in report.vocabulary.types}
    lines.append("active memory_type_packs:")
    if not preflight.packs:
        lines.append("  none active")
    for pack in preflight.packs:
        added = [value for value in pack.types if value not in frozen]
        suffix = (
            f"  -- adds {', '.join(added)}, outside every frozen vocabulary" if added else ""
        )
        lines.append(
            f"  {pack.slug} v{pack.version} ({len(pack.types)} types): "
            f"{', '.join(pack.types)}{suffix}"
        )
    lines.append("")

    if preflight.quarantined_feedback is None:
        lines.append(
            "recommendation_feedback.workspace_id is absent, so 0069 is not applied on "
            "this database."
        )
    else:
        lines.append(
            "recommendation_feedback rows with workspace_id IS NULL: "
            f"{preflight.quarantined_feedback}"
        )
        lines.append(
            "  0069's downgrade drops that column. It does not delete these rows; it "
            "removes the marker that keeps them out of preference learning, so they "
            "rejoin the cross-workspace aggregation the column was added to stop."
        )
    lines.append("")

    if preflight.rls_note:
        lines.extend([f"NOTE: {preflight.rls_note}", ""])

    if preflight.would_refuse:
        lines.extend(
            [
                "VERDICT: at least one downgrade would refuse.",
                "  Do NOT restore a backup to clear this. The rows named above are valid "
                "under the domain-pack registry; a backup restore deletes them and every "
                "write since the backup with them.",
                "  Run this preflight, take the named values, then decide: forward-migrate "
                "them into the old vocabulary, or accept the new revision. See "
                "docs/operations/Rollback-Strategy.md.",
            ]
        )
    else:
        lines.append(
            "VERDICT: neither downgrade would refuse on the rows visible to this session."
        )
    return "\n".join(lines)


# --------------------------------------------------------------------------
# Entry point
# --------------------------------------------------------------------------


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    """Parse arguments. The URL defaults to the migrations' own target."""
    parser = argparse.ArgumentParser(
        prog="check_pg_downgrade",
        description=(
            "Report whether `alembic downgrade` across 0069/0068 would refuse, and on "
            "which values. Read-only."
        ),
    )
    parser.add_argument(
        "--pg-url",
        default=os.environ.get(TARGET_URL_ENV_VAR),
        help=f"target PostgreSQL URL (default: ${TARGET_URL_ENV_VAR}).",
    )
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)

    url = (args.pg_url or "").strip()
    if not url:
        print(
            "refusing to run: no target database URL. Pass --pg-url, or set the "
            f"{TARGET_URL_ENV_VAR} environment variable. This script inspects the "
            "database the migrations ran against; a disposable one holds no rows and "
            "answers nothing.",
            file=sys.stderr,
        )
        return 2

    try:
        contract = downgrade_contract()
    except PreflightError as exc:
        print(f"refusing to run: {exc}", file=sys.stderr)
        return 2

    try:
        preflight = collect_preflight(url, contract)
    except PreflightError as exc:
        print(f"refusing to run: {redact(str(exc))}", file=sys.stderr)
        return 2

    print(render(preflight))
    return 1 if preflight.would_refuse else 0


if __name__ == "__main__":
    raise SystemExit(main())