"""Preflight guards for ``scripts/check_pg_downgrade.py``.

The script's entire product is an answer an operator acts on: *would the 0069/0068
downgrades refuse, and on which values*. A false negative sends them into a
``downgrade`` that stops part-way; a false positive sends them into a data-forwarding
excursion for a refusal that was never going to happen. Both are worse than a script
that said "I could not determine", which is why that is an exit code here.

So what is under test are the three ways this answer can be wrong:

* a vocabulary read from anywhere but the migrations, so rows are judged against a
  list that no longer describes the CHECK (provenance);
* a transaction that is only *believed* read-only, so the inspection itself writes;
* a refusal that does not name the value, which is the same as not naming the
  constraint (the report and the exit codes).

The module is loaded by path -- ``scripts/`` is not an importable package -- and the
``sys.modules`` entry before ``exec_module`` is load-bearing here for the same reason
it is in ``tests/test_verify_pg_migrations_script.py:44-53``: the script is ``from
__future__ import annotations``, so every ``@dataclass`` field annotation is a string
that ``dataclasses`` resolves through ``sys.modules[cls.__module__]``. Registered
after the fact, that lookup is ``None`` and the decorator raises ``AttributeError:
'NoneType' object has no attribute '__dict__'``.

The live-PostgreSQL tests at the bottom are what prove the ``BEGIN READ ONLY``
mechanism against a real server. They skip unless ``VAELOOM_TEST_PG_URL`` is set,
following ``tests/test_migration_chain_pg.py``.
"""

from __future__ import annotations

import asyncio

import contextlib
import importlib.util
import io
import json
import os
import pathlib
import re
import sys

import pytest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[3]
SCRIPT_PATH = REPO_ROOT / "scripts" / "check_pg_downgrade.py"
MIGRATION_0027 = (
    REPO_ROOT / "apps" / "api" / "alembic" / "versions" / "0027_memory_taxonomy_expand_contract.py"
)

# A type no domain pack declares and no frozen vocabulary lists. Stands in for the
# second pack's contribution throughout; whether it really is outside the vocabulary
# is asserted rather than assumed -- see
# test_the_planted_offending_value_is_really_outside_the_vocabulary.
SECOND_PACK_TYPE = "job_posting"

# Carries a password so the redaction assertions have something real to strip. This
# is a local verification container; the credential is not a real one.
PG_URL = "postgresql://postgres:vaeloom_verify_pw@127.0.0.1:5433/vaeloom_test"


def _load_script():
    """Import scripts/check_pg_downgrade.py so its guards can be called directly."""
    assert SCRIPT_PATH.exists(), f"preflight script not found at {SCRIPT_PATH}"
    spec = importlib.util.spec_from_file_location("check_pg_downgrade_under_test", SCRIPT_PATH)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


script = _load_script()


# --------------------------------------------------------------------------
# Standing in for the database
# --------------------------------------------------------------------------


def _frozen_types() -> list[str]:
    """The 0068 vocabulary, read from the script -- never retyped in this file."""
    return list(script.frozen_vocabularies()[0].types)


def _default_rows() -> dict[str, list[tuple]]:
    """Rows for every query the script issues, all benign.

    Every relation present, the session a superuser (so no RLS caveat), one active
    pack, and types drawn from the frozen vocabulary so nothing refuses. Each test
    overrides only the keys it is about.
    """
    return {
        "relations": [
            ("memories", True),
            ("memory_records", True),
            ("memory_type_packs", True),
        ],
        "feedback_column": [(1,)],
        "rls_flags": [("memories", False), ("memory_records", False)],
        "session_role": [(True, True)],
        "types:memories": [("career", 12), ("note", 3)],
        "types:memory_records": [("document", 9)],
        "packs": [("career", 1, json.dumps(_frozen_types()))],
        "feedback_null_workspace": [(17,)],
    }


def _stub_database(monkeypatch, rows: dict[str, list[tuple]]):
    """Replace ``_run_read_only``, recording every query the script handed it."""
    calls: list[list] = []

    def fake_run_read_only(_url, queries):
        batch = list(queries)
        calls.append(batch)
        try:
            return [rows[query.key] for query in batch]
        except KeyError as exc:
            raise AssertionError(
                f"the script issued an unexpected query key {exc.args[0]!r}; the stub "
                f"knows {sorted(rows)}"
            ) from exc

    monkeypatch.setattr(script, "_run_read_only", fake_run_read_only)
    return calls


def _run_main(monkeypatch, rows: dict[str, list[tuple]] | None = None):
    """Run ``main`` against the stubbed database.

    Returns ``(exit code, stdout, stderr, query batches)``. The query batches are
    handed back because several tests are about what the script *issued*, not about
    what it concluded.
    """
    calls = _stub_database(monkeypatch, _default_rows() if rows is None else rows)
    out, err = io.StringIO(), io.StringIO()
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
        code = script.main(["--pg-url", PG_URL])
    return code, out.getvalue(), err.getvalue(), calls


def _issued_sql(calls) -> list[str]:
    return [query.sql for batch in calls for query in batch]


# --------------------------------------------------------------------------
# Provenance: the vocabulary is read from the migrations, not restated
# --------------------------------------------------------------------------


def _constraint_literals_from_0027(constraint: str) -> tuple[str, ...]:
    """The literals 0027 wrote into one of its two CHECK constraints.

    Parsed out of the migration file, never from a constant in this test: comparing
    the script against a list typed here would pass for as long as the list agreed
    with itself, which is the drift this test exists to catch.
    """
    source = MIGRATION_0027.read_text(encoding="utf-8")
    marker = f"ADD CONSTRAINT {constraint}"
    assert marker in source, f"{MIGRATION_0027.name} no longer contains {marker}"
    start = source.index("type IN (", source.index(marker)) + len("type IN (")
    end = source.index(")", start)
    return tuple(re.findall(r"'([^']+)'", source[start:end]))


def test_the_script_reads_each_vocabulary_from_its_own_migration():
    """One vocabulary per downgrade: 0068's for memories, 0069's for memory_records.

    Separate assertions because the failure is per-table. A script that judged
    ``memory_records`` against 0068's list would still be exactly right for
    ``memories`` and would report one refusal too few.
    """
    memories_vocabulary, records_vocabulary = script.frozen_vocabularies()

    assert (memories_vocabulary.revision, memories_vocabulary.table) == ("0068", "memories")
    assert memories_vocabulary.constraint == "ck_memories_type_valid"

    assert (records_vocabulary.revision, records_vocabulary.table) == ("0069", "memory_records")
    assert records_vocabulary.constraint == "ck_memory_records_type_valid"


@pytest.mark.parametrize(
    ("revision", "constraint"),
    [("0068", "ck_memories_type_valid"), ("0069", "ck_memory_records_type_valid")],
)
def test_each_vocabulary_is_identical_to_the_literals_0027_froze(revision, constraint):
    """The drift guard: the script's vocabulary is 0027's, read from 0027.

    0068 reinstates ``ck_memories_type_valid`` and 0069 reinstates
    ``ck_memory_records_type_valid``, and 0027 wrote both. So the authoritative
    statement of "which literals does a rollback reinstate" lives in 0027. Comparing
    the script against a constant in *this* file instead would let a migration change
    the CHECK while the test kept agreeing with a list nothing consults.
    """
    expected = _constraint_literals_from_0027(constraint)
    assert len(expected) == 24, (
        f"0027 froze {len(expected)} literals for {constraint}, not the 24 this "
        "migration chain and every document describing it assume"
    )

    vocabulary = next(v for v in script.frozen_vocabularies() if v.revision == revision)

    assert set(vocabulary.types) == set(expected), (
        f"{revision} reinstates {constraint} over {sorted(vocabulary.types)} but 0027 "
        f"froze {sorted(expected)}; a rollback would then accept or reject different "
        "types than the migration being restored"
    )
    assert len(vocabulary.types) == len(set(vocabulary.types)), (
        "a duplicated literal means the parser matched something other than the list"
    )


def test_the_planted_offending_value_is_really_outside_the_vocabulary():
    """Negative control for every refusal test below.

    ``SECOND_PACK_TYPE`` stands in for a second domain pack's contribution. If a
    migration ever added it to a frozen list, the refusal tests would stop detecting
    anything while still passing -- the same green-by-absence failure this suite
    exists to eliminate, one level up.
    """
    for vocabulary in script.frozen_vocabularies():
        assert SECOND_PACK_TYPE not in vocabulary.types, (
            f"{vocabulary.constraint} now lists '{SECOND_PACK_TYPE}', so it can no "
            "longer stand in for a type that only a second pack allows"
        )


# --------------------------------------------------------------------------
# Refusal detection, per vocabulary and independently
# --------------------------------------------------------------------------


def test_a_type_outside_0068s_vocabulary_makes_the_0068_downgrade_refuse(monkeypatch):
    rows = _default_rows()
    rows["types:memories"] = [("career", 12), (SECOND_PACK_TYPE, 4)]

    code, out, _err, _calls = _run_main(monkeypatch, rows)

    assert code == 1, "a second pack's rows make 0068's downgrade refuse; exit must be 1"
    assert SECOND_PACK_TYPE in out, (
        f"the refusal must name the offending value -- that value is the whole output: {out!r}"
    )
    assert "4 rows" in out, "the row count tells the operator how much is in the way"
    assert "ck_memories_type_valid" in out
    assert "0068's downgrade WOULD REFUSE" in out


def test_a_type_outside_0069s_vocabulary_makes_the_0069_downgrade_refuse(monkeypatch):
    rows = _default_rows()
    rows["types:memory_records"] = [("document", 9), (SECOND_PACK_TYPE, 2)]

    code, out, _err, _calls = _run_main(monkeypatch, rows)

    assert code == 1, "0069 restores a second frozen vocabulary; it must be judged too"
    assert SECOND_PACK_TYPE in out
    assert "2 rows" in out
    assert "ck_memory_records_type_valid" in out
    assert "0069's downgrade WOULD REFUSE" in out


def test_each_table_is_judged_only_against_its_own_downgrades_vocabulary(monkeypatch):
    """A second pack on ``memories`` must not implicate ``memory_records``.

    The two reinstatements are separate constraints on separate tables. Reporting a
    refusal against the wrong one sends the operator to migrate data the other
    revision never constrained -- so the *absence* of a refusal is asserted here, not
    just the presence of one.
    """
    rows = _default_rows()
    rows["types:memories"] = [(SECOND_PACK_TYPE, 7)]

    code, out, _err, _calls = _run_main(monkeypatch, rows)

    assert code == 1
    assert "0068's downgrade WOULD REFUSE" in out
    assert "0069's downgrade would not refuse on this table" in out, (
        f"memory_records holds only frozen types here and must be reported as such: {out!r}"
    )


def test_no_type_outside_either_vocabulary_means_no_refusal(monkeypatch):
    code, out, _err, _calls = _run_main(monkeypatch)

    assert code == 0, "a clean database must let the operator proceed to the downgrade"
    assert "outside the frozen vocabulary: none" in out
    assert "VERDICT: neither downgrade would refuse" in out


def test_only_the_illegal_type_is_reported_as_offending(monkeypatch):
    """Partial overlap: legal types present alongside one illegal one.

    The report must name only the illegal one. Reporting the whole population as
    offending would make every database holding data look like a refusal.
    """
    frozen = _frozen_types()
    legal_a, legal_b = frozen[0], frozen[1]
    rows = _default_rows()
    rows["types:memories"] = [(legal_a, 5), (SECOND_PACK_TYPE, 1), (legal_b, 2)]

    code, out, _err, _calls = _run_main(monkeypatch, rows)

    assert code == 1
    present = sorted([(legal_a, 5), (SECOND_PACK_TYPE, 1), (legal_b, 2)])
    assert f"distinct types present: {', '.join(f'{v} ({c})' for v, c in present)}" in out
    assert f"outside the frozen vocabulary: {SECOND_PACK_TYPE} (1 rows)" in out
    offending_line = next(
        line for line in out.splitlines() if "outside the frozen vocabulary:" in line
    )
    assert legal_a not in offending_line and legal_b not in offending_line, (
        f"a type the CHECK restores legally is not offending: {offending_line!r}"
    )


def test_a_null_type_cannot_cause_a_refusal(monkeypatch):
    """``NULL IN (...)`` is not false, so the restored CHECK accepts a NULL type.

    Counting NULL as offending would exit 1 against a database the downgrade would
    sail through -- the preflight's version of a false alarm.
    """
    rows = _default_rows()
    rows["types:memories"] = [(None, 3), ("career", 1)]

    code, out, _err, _calls = _run_main(monkeypatch, rows)

    assert code == 0
    assert "3 row(s) have a NULL type" in out
    assert "not counted as offending" in out


# --------------------------------------------------------------------------
# The report: what the operator is told
# --------------------------------------------------------------------------


def test_the_report_names_the_second_pack_that_added_the_value(monkeypatch):
    rows = _default_rows()
    rows["packs"] = [
        ("career", 1, json.dumps(_frozen_types())),
        ("job_search", 2, json.dumps([SECOND_PACK_TYPE, "application"])),
    ]
    rows["types:memories"] = [(SECOND_PACK_TYPE, 4)]

    _code, out, _err, _calls = _run_main(monkeypatch, rows)

    assert "job_search v2" in out
    assert f"adds {SECOND_PACK_TYPE}, application, outside every frozen vocabulary" in out


def test_the_report_contradicts_the_backup_restore_an_operator_reaches_for(monkeypatch):
    """This is the harm the script exists to prevent.

    ``Rollback-Strategy.md`` tells an operator to restore from backup when a migration
    will not reverse. For 0068/0069 that destroys the legitimate data that caused the
    refusal, so the report has to say so where the operator is reading it.
    """
    rows = _default_rows()
    rows["types:memories"] = [(SECOND_PACK_TYPE, 4)]

    _code, out, _err, _calls = _run_main(monkeypatch, rows)

    assert "Do NOT restore a backup to clear this" in out
    assert "Rollback-Strategy.md" in out, "the operator is pointed at the written procedure"


def test_the_report_counts_the_rows_whose_workspace_column_a_rollback_drops(monkeypatch):
    _code, out, _err, _calls = _run_main(monkeypatch)

    assert "recommendation_feedback rows with workspace_id IS NULL: 17" in out
    assert "It does not delete these rows" in out, (
        "the impact is losing the quarantine marker, not losing rows; overstating it "
        "would send an operator after the wrong data"
    )


def test_the_report_says_so_when_0069_has_not_been_applied(monkeypatch):
    rows = _default_rows()
    rows["feedback_column"] = [(0,)]
    del rows["feedback_null_workspace"]

    _code, out, _err, calls = _run_main(monkeypatch, rows)

    assert "workspace_id is absent" in out
    assert all(
        query.key != "feedback_null_workspace" for query in calls[-1]
    ), "a column that does not exist must not be queried"


def test_a_row_hiding_role_is_told_its_verdict_may_be_blind(monkeypatch):
    """FORCE-RLS plus unset GUCs reads as zero rows, with no error.

    ``memories`` is workspace-scoped, so a non-superuser session sees nothing and
    would otherwise be handed a confident green about data it never looked at.
    """
    rows = _default_rows()
    rows["rls_flags"] = [("memories", True), ("memory_records", False)]
    rows["session_role"] = [(False, False)]
    rows["types:memories"] = []

    code, out, _err, _calls = _run_main(monkeypatch, rows)

    assert code == 0
    assert "NOTE:" in out
    assert "no offending rows were visible" in out


def test_a_bypassing_role_is_not_warned(monkeypatch):
    rows = _default_rows()
    rows["rls_flags"] = [("memories", True)]
    rows["session_role"] = [(True, False)]

    _code, out, _err, _calls = _run_main(monkeypatch, rows)

    assert "NOTE:" not in out, "a superuser sees every row; the caveat would be noise"


def test_no_credential_reaches_the_report(monkeypatch):
    code, out, err, _calls = _run_main(monkeypatch)

    assert "vaeloom_verify_pw" not in out
    assert "vaeloom_verify_pw" not in err
    assert "127.0.0.1:5433/vaeloom_test" in out, (
        "the operator still needs to know which database was inspected"
    )
    assert code == 0


def test_redact_strips_userinfo_from_a_driver_message():
    message = (
        'connection to server at "db.internal", port 5432 failed: FATAL: password '
        'authentication failed for user "vaeloom_app" '
        "(postgresql://vaeloom_app:hunter2@db.internal:5432/postgres)"
    )

    cleaned = script.redact(message)

    assert "hunter2" not in cleaned
    assert "postgresql://***@db.internal:5432/postgres" in cleaned
    assert "FATAL: password authentication failed" in cleaned, (
        "the message itself must survive; only the credential goes"
    )


# --------------------------------------------------------------------------
# The read-only verification
# --------------------------------------------------------------------------


class _FakeResult:
    def __init__(self, rows):
        self._rows = list(rows)

    def fetchall(self):
        return list(self._rows)


class _FakeConnection:
    def __init__(self, responses, log):
        self._responses = responses
        self.log = log

    async def execute(self, statement, parameters=None):
        sql = str(statement)
        self.log.append(sql)
        return _FakeResult(self._responses.get(sql, []))


class _FakeConnectContext:
    def __init__(self, connection):
        self._connection = connection

    async def __aenter__(self):
        return self._connection

    async def __aexit__(self, *_exc):
        return False


class _FakeEngine:
    def __init__(self, responses, log):
        self.connection = _FakeConnection(responses, log)
        self.disposed = False

    def connect(self):
        return _FakeConnectContext(self.connection)

    async def dispose(self):
        self.disposed = True


def _fake_engine(monkeypatch, responses):
    log: list[str] = []
    engine = _FakeEngine(responses, log)
    monkeypatch.setattr(script, "_create_engine", lambda _url: engine)
    return engine, log


def test_begin_read_only_opens_the_transaction_and_is_verified_first(monkeypatch):
    """The first two statements are the guard and its check; nothing precedes them.

    Asserted against the statement log rather than the report, because the failure
    being guarded is a query that ran before the verification did.
    """
    engine, log = _fake_engine(
        monkeypatch,
        {
            "SHOW transaction_read_only": [("on",)],
            "SELECT type::text, count(*) FROM memories GROUP BY 1 ORDER BY 1": [("career", 1)],
        },
    )

    script._run_read_only(
        PG_URL,
        [script._Query("types:memories", script._type_counts_query("memories"))],
    )

    assert log[0] == "BEGIN READ ONLY"
    assert log[1] == "SHOW transaction_read_only"
    assert log[-1] == "COMMIT"
    assert all(sql.startswith("SELECT") for sql in log[2:-1]), (
        f"only SELECTs belong inside the read-only transaction, saw {log}"
    )
    assert engine.disposed, "the connection must be released even when a check aborts"


@pytest.mark.parametrize("setting", ["off", "", "off\n", None, "false"])
def test_the_run_aborts_when_the_server_does_not_confirm_read_only(monkeypatch, setting):
    _engine, log = _fake_engine(monkeypatch, {"SHOW transaction_read_only": [(setting,)]})

    with pytest.raises(script.ReadOnlyNotVerified) as exc:
        script._run_read_only(PG_URL, [script._Query("k", "SELECT 1")])

    assert log == ["BEGIN READ ONLY", "SHOW transaction_read_only"], (
        f"the inspection must stop at the check; it went on to run {log[2:]}"
    )
    assert repr(setting) in str(exc.value), (
        f"the refusal must report what the server actually said: {exc.value!r}"
    )
    assert "pooler" in str(exc.value)


def test_read_only_verification_failure_exits_two_and_prints_no_verdict(monkeypatch, capsys):
    """The abort is reached the way an operator reaches it: from a server that says no.

    Patched at the engine rather than at ``_run_read_only``, because the wrapper that
    turns a refusal into exit 2 is part of what is being tested -- stubbing it away
    would leave the exception uncaught and prove nothing about the verdict.
    """
    _fake_engine(monkeypatch, {"SHOW transaction_read_only": [("off",)]})

    code = script.main(["--pg-url", PG_URL])

    captured = capsys.readouterr()
    assert code == 2, "2 is 'could not determine', which is not the same answer as 1"
    assert captured.out == "", "no verdict may be printed when the check never ran"
    assert "read-only" in captured.err


# --------------------------------------------------------------------------
# Only SELECTs, and nothing rendered from a database that cannot answer
# --------------------------------------------------------------------------


def test_every_statement_the_script_issues_is_a_select(monkeypatch):
    calls = _stub_database(monkeypatch, _default_rows())

    script.main(["--pg-url", PG_URL])

    issued = _issued_sql(calls)
    assert issued, "the stub recorded nothing; this test would pass vacuously"
    offenders = [sql for sql in issued if not sql.lstrip().upper().startswith("SELECT")]
    assert not offenders, (
        f"a script whose stated property is that it only reads must not issue {offenders}"
    )


def test_table_names_are_refused_rather_than_interpolated_when_unsafe():
    with pytest.raises(script.PreflightError) as exc:
        script._type_counts_query("memories; DROP TABLE users")
    assert "not a usable PostgreSQL identifier" in str(exc.value)


def test_a_missing_table_is_cannot_determine_not_a_clean_bill_of_health(monkeypatch):
    """An absent table renders exactly like an empty one unless it is caught.

    ``exit 0`` against a database with no ``memories`` would be the worst available
    answer: "safe to roll back", about a database the script never looked at.
    """
    rows = _default_rows()
    rows["relations"] = [
        ("memories", True),
        ("memory_records", False),
        ("memory_type_packs", True),
    ]

    code, out, err, _calls = _run_main(monkeypatch, rows)

    assert code == 2
    assert out == "", "no verdict may be rendered from a database missing its tables"
    assert "memory_records" in err
    assert "not at a disposable one" in err


def test_a_driver_failure_becomes_cannot_determine_and_is_redacted(monkeypatch, capsys):
    """A connection failure must not escape as a traceback, and must not leak the DSN."""

    class _UnreachableEngine:
        def connect(self):
            raise RuntimeError(
                "could not connect to postgresql://vaeloom_app:hunter2@db.internal:5432/postgres"
            )

        async def dispose(self):
            return None

    monkeypatch.setattr(script, "_create_engine", lambda _url: _UnreachableEngine())

    code = script.main(["--pg-url", PG_URL])

    captured = capsys.readouterr()
    assert code == 2
    assert "hunter2" not in captured.err, f"the DSN was echoed: {captured.err!r}"
    assert "could not connect to" in captured.err
    assert captured.out == ""
    assert "Traceback" not in captured.err


# --------------------------------------------------------------------------
# Exit codes
# --------------------------------------------------------------------------


def test_no_url_from_either_source_is_a_refusal_naming_both(monkeypatch, capsys):
    monkeypatch.delenv(script.TARGET_URL_ENV_VAR, raising=False)

    code = script.main([])

    assert code == 2
    stderr = capsys.readouterr().err
    assert "--pg-url" in stderr and script.TARGET_URL_ENV_VAR in stderr
    assert "Traceback" not in stderr, f"a missing URL must not produce a traceback: {stderr!r}"


def test_the_url_defaults_to_the_migrations_own_target_variable(monkeypatch):
    monkeypatch.setenv(script.TARGET_URL_ENV_VAR, PG_URL)
    assert script.parse_args([]).pg_url == PG_URL

    override = "postgresql://other/db"
    assert script.parse_args(["--pg-url", override]).pg_url == override


def test_the_three_outcomes_carry_three_different_exit_codes(monkeypatch):
    """0, 1 and 2 must not be interchangeable, or a caller cannot act on them."""

    refusing = _default_rows()
    refusing["types:memories"] = [(SECOND_PACK_TYPE, 1)]

    undeterminable = _default_rows()
    undeterminable["relations"] = [
        ("memories", False),
        ("memory_records", False),
        ("memory_type_packs", False),
    ]

    codes = {
        _run_main(monkeypatch)[0],
        _run_main(monkeypatch, refusing)[0],
        _run_main(monkeypatch, undeterminable)[0],
    }
    assert codes == {0, 1, 2}, f"the three outcomes must be distinguishable, got {codes}"


# --------------------------------------------------------------------------
# Live PostgreSQL: the read-only mechanism, measured rather than asserted
# --------------------------------------------------------------------------

requires_pg = pytest.mark.skipif(
    not os.environ.get("VAELOOM_TEST_PG_URL"),
    reason="set VAELOOM_TEST_PG_URL to a disposable PostgreSQL to run this",
)


@requires_pg
async def test_the_verified_transaction_really_refuses_a_write():
    """``BEGIN READ ONLY`` on a real server, proven by trying to write inside it.

    ``SHOW transaction_read_only`` answering ``on`` is the script's own check, so
    trusting it alone would be circular. Attempting the write is the independent
    proof: PostgreSQL rejects DDL inside a read-only transaction, so this passes only
    if the transaction really is read-only. ``CREATE TEMP`` rather than ``CREATE
    TABLE`` so that a bug in this assertion cannot leave a table behind.
    """
    engine = script._create_engine(os.environ["VAELOOM_TEST_PG_URL"])
    try:
        async with engine.connect() as connection:
            await connection.execute(script._text("BEGIN READ ONLY"))
            reported = (
                await connection.execute(script._text("SHOW transaction_read_only"))
            ).scalar()
            assert str(reported).strip() == "on", (
                f"the script verifies this exact value, so a server answering "
                f"{reported!r} is one it would refuse rather than trust"
            )
            with pytest.raises(Exception) as exc:
                await connection.execute(
                    script._text("CREATE TEMP TABLE _check_pg_downgrade_write_probe (id integer)")
                )
            assert "read-only" in str(exc.value).lower(), (
                "the write failed for some reason other than the read-only transaction, "
                f"so nothing was proven: {exc.value!r}"
            )
            await connection.execute(script._text("COMMIT"))
    finally:
        await engine.dispose()


@requires_pg
async def test_the_preflight_runs_against_a_real_migrated_database():
    """End to end on the disposable chain container: a verdict, not a crash.

    On a freshly migrated database every memory table is empty, so the answer must
    be 0 -- and it must be reached by reading the database rather than by short
    circuiting, which is what the missing-table test pins from the other side.
    """
    # The preflight is a sync CLI entry point, so it is bridged onto a worker
    # thread rather than awaited: calling asyncio.run from inside this test's own
    # running loop raises, and the fix belongs here, not in the tool.
    preflight = await asyncio.to_thread(
        script.collect_preflight,
        os.environ["VAELOOM_TEST_PG_URL"],
        script.downgrade_contract(),
    )

    assert [report.vocabulary.table for report in preflight.reports] == [
        "memories",
        "memory_records",
    ]
    assert preflight.would_refuse is False, (
        "the disposable chain database holds no memory rows, so nothing can refuse; a "
        "refusal here means the vocabulary was read wrongly"
    )
    assert "career" in {pack.slug for pack in preflight.packs}, (
        "0068 seeds the career pack; its absence means the registry was never read"
    )
    assert "VERDICT: neither downgrade would refuse" in script.render(preflight)