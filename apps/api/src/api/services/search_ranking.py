import json
import os
from datetime import UTC, datetime

from ..services.llm_service import LLMService

DEFAULT_WEIGHTS = {
    "relevance": 0.4,
    "recency": 0.3,
    "importance": 0.2,
    "user_preference": 0.1,
}


def _load_weights() -> dict[str, float]:
    raw = os.environ.get("RANKING_WEIGHTS", "")
    if raw:
        try:
            parsed = json.loads(raw)
            if all(k in parsed for k in ("relevance", "recency", "importance", "user_preference")):
                return parsed
        except (json.JSONDecodeError, TypeError):
            pass
    return dict(DEFAULT_WEIGHTS)


class SearchRankingService:
    def __init__(self, llm_service: LLMService | None = None):
        self._weights = _load_weights()
        self._llm = llm_service

    def calculate_score(
        self,
        result: dict,
        query: str,
        user_context: dict | None = None,
    ) -> float:
        relevance = self._relevance_score(result, query)
        recency = self._recency_score(result)
        importance = self._importance_score(result)
        preference = self._preference_score(result, user_context)

        return (
            self._weights["relevance"] * relevance
            + self._weights["recency"] * recency
            + self._weights["importance"] * importance
            + self._weights["user_preference"] * preference
        )

    def rank_results(
        self,
        results: list[dict],
        query: str,
        user_context: dict | None = None,
    ) -> list[dict]:
        scored = []
        for r in results:
            r["_combined_score"] = self.calculate_score(r, query, user_context)
            scored.append(r)
        scored.sort(key=lambda x: x["_combined_score"], reverse=True)
        return scored

    async def rerank_with_llm(
        self,
        results: list[dict],
        query: str,
    ) -> list[dict]:
        if not self._llm or not results:
            return results

        top_k = results[:10]
        payload = {
            "query": query,
            "results": [
                {"id": r.get("id", ""), "text": r.get("text", ""), "source": r.get("source", "")}
                for r in top_k
            ],
        }
        prompt = (
            "You are a search relevance judge. Given a query and a list of results, "
            "re-rank them by relevance. Return a JSON array of result IDs in order of "
            f"most to least relevant.\n\nQuery: {query}\n\nResults: {json.dumps(payload['results'])}"
        )
        try:
            resp = await self._llm.generate_completion(
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=512,
            )
            content = resp.get("content", "")
            ordered_ids = json.loads(content)
            id_order = {rid: i for i, rid in enumerate(ordered_ids)}
            top_k.sort(key=lambda r: id_order.get(r.get("id", ""), len(top_k)))
            return top_k + results[10:]
        except Exception:
            return results

    def _relevance_score(self, result: dict, query: str) -> float:
        text = (result.get("text", "") or "") + " " + (result.get("metadata", {}).get("summary", "") or "")
        q_lower = query.lower()
        if q_lower in text.lower():
            return 1.0
        words = q_lower.split()
        if words and any(w in text.lower() for w in words):
            return 0.5
        return 0.0

    def _recency_score(self, result: dict) -> float:
        created = result.get("metadata", {}).get("created_at") or result.get("created_at")
        if not created:
            return 0.5
        try:
            if isinstance(created, str):
                dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
            else:
                dt = created
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=UTC)
            age_hours = (datetime.now(UTC) - dt).total_seconds() / 3600
            if age_hours < 1:
                return 1.0
            if age_hours < 24:
                return 0.9
            if age_hours < 168:
                return 0.7
            if age_hours < 720:
                return 0.4
            return 0.1
        except (ValueError, TypeError):
            return 0.5

    def _importance_score(self, result: dict) -> float:
        imp = result.get("metadata", {}).get("importance")
        if imp is not None:
            return min(float(imp), 1.0)
        score = result.get("score", 0.0)
        return min(score / 2.0, 1.0)

    def _preference_score(self, result: dict, user_context: dict | None) -> float:
        if not user_context:
            return 0.5
        preferred_types = user_context.get("preferred_types", [])
        source = result.get("source", "")
        if source in preferred_types:
            return 1.0
        preferred_tags = user_context.get("preferred_tags", [])
        tags = result.get("metadata", {}).get("tags", [])
        if tags and preferred_tags and any(t in preferred_tags for t in tags):
            return 0.8
        # WS01: also match preferred_tags against text for direct preference learning (e.g., "remote senior")
        text = (result.get("text","") + " " + result.get("metadata",{}).get("summary","")).lower()
        if preferred_tags and any(pt.lower() in text for pt in preferred_tags if pt):
            return 0.85
        return 0.5

    def rrf_fusion(self, dense_ranked: list[dict], lexical_ranked: list[dict], k: int = 60, weight_dense: float = 0.5, weight_lexical: float = 0.5) -> list[dict]:
        """Reciprocal Rank Fusion (Cormack et al. SIGIR 2009) for hybrid retrieval.

        Args:
            dense_ranked: vector results ordered most→least relevant
            lexical_ranked: lexical (tsvector/keyword) results ordered most→least
            k: RRF constant (60 typical)
            weight_dense/lexical: per-list weighting (WS02 experiments A-G sweep 0.25/0.75 etc.)
        Returns fused list ordered by RRF score.
        """
        scores: dict[str, float] = {}
        id_to_item: dict[str, dict] = {}
        for rank, item in enumerate(dense_ranked):
            iid = item.get("id","")
            if not iid:
                continue
            scores[iid] = scores.get(iid, 0.0) + weight_dense * (1.0 / (k + rank + 1))
            id_to_item[iid] = item
        for rank, item in enumerate(lexical_ranked):
            iid = item.get("id","")
            if not iid:
                continue
            scores[iid] = scores.get(iid, 0.0) + weight_lexical * (1.0 / (k + rank + 1))
            if iid not in id_to_item:
                id_to_item[iid] = item
        fused = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        out = []
        for iid, sc in fused:
            it = dict(id_to_item[iid])
            it["_rrf_score"] = sc
            out.append(it)
        return out


search_ranking_service = SearchRankingService()
