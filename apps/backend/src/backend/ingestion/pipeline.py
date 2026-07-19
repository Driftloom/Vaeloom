import asyncio
import logging
from typing import Dict, Any
import hashlib

from .parsers import parse_document, UnsupportedFormatError
from .dedup import check_dedup

logger = logging.getLogger(__name__)

async def run_pipeline(workspace_id: str, filename: str, content: bytes) -> Dict[str, Any]:
    """
    Run the ingestion pipeline:
    Source -> format detection -> parser dispatch -> OCR -> structure extraction -> dedup -> write row -> event
    """
    try:
        # 1. & 2. & 3. Format detection, parser dispatch, OCR / structure extraction
        parsed_doc = await parse_document(filename, content)
        
        # 4. Dedup & Version Check
        content_hash = hashlib.sha256(content).hexdigest()
        existing_doc_id = await check_dedup(workspace_id, content_hash, filename)
        
        # 5. Write to DB (Mocked)
        document_id = "new_doc_id_456"
        version_id = "version_1"
        if existing_doc_id:
            document_id = existing_doc_id
            version_id = "version_2"
            logger.info(f"Writing document_versions row for doc {document_id}")
        else:
            logger.info(f"Writing new documents row {document_id}")
            
        # 6. Publish Event
        logger.info(f"Published event: ingest.completed for {document_id}")
        
        return {
            "status": "success",
            "document_id": document_id,
            "version_id": version_id,
            "metadata": parsed_doc.metadata
        }

    except UnsupportedFormatError as e:
        logger.error(str(e))
        return {"status": "error", "reason": str(e)}
    except Exception as e:
        logger.error(f"Ingestion failed: {e}")
        return {"status": "error", "reason": str(e)}
