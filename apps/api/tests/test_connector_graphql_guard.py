"""GraphQL stored-query guard tests (CON-GQL-01). Pure validator, no fixtures needed."""

import pytest
from fastapi import HTTPException

from api.services.connector_ext_service import validate_graphql_query

pytestmark = pytest.mark.asyncio


async def test_valid_simple_query_passes():
    validate_graphql_query("{ user { id name } }")
    validate_graphql_query("query GetUser { user(id: 1) { id name email } }")


async def test_empty_and_oversized_rejected():
    with pytest.raises(HTTPException):
        validate_graphql_query("")
    with pytest.raises(HTTPException):
        validate_graphql_query("   ")
    with pytest.raises(HTTPException):
        validate_graphql_query("{ a }" * 20000)


async def test_introspection_blocked_even_in_comments_or_strings():
    with pytest.raises(HTTPException):
        validate_graphql_query("{ __schema { types { name } } }")
    with pytest.raises(HTTPException):
        validate_graphql_query("{ user { id } } # __type probe")


async def test_deep_nesting_rejected():
    deep = "{ a" * 12 + " id " + "}" * 12
    with pytest.raises(HTTPException) as exc:
        validate_graphql_query(deep)
    assert "depth" in exc.value.detail.lower()


async def test_unbalanced_braces_rejected():
    with pytest.raises(HTTPException):
        validate_graphql_query("{ user { id }")
    with pytest.raises(HTTPException):
        validate_graphql_query("user { id } }")


async def test_field_count_cap():
    many = "{ " + " ".join(f"f{i}" for i in range(250)) + " }"
    with pytest.raises(HTTPException) as exc:
        validate_graphql_query(many)
    assert "field" in exc.value.detail.lower()


async def test_braces_inside_strings_do_not_count():
    validate_graphql_query('{ search(term: "a { b } c") { id } }')


async def test_non_string_rejected():
    with pytest.raises(HTTPException):
        validate_graphql_query(None)
    with pytest.raises(HTTPException):
        validate_graphql_query({"query": "{ a }"})
