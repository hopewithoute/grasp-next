import uuid
from typing import Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.indexing.content_hash import compute_content_hash
from app.storage.repositories import SourceRepository
from app.parsing.text import parse_text
from app.parsing.markdown import parse_markdown
from app.chunking.factory import create_chunker
from app.chunking.contracts import ChunkDocumentInput, ChunkingOptions
from app.extraction.factory import create_term_extractor
from app.extraction.contracts import Chunk as ExtractorChunk
from app.embedding.factory import create_embedding_runtime
from app.settings import get_settings
from app.storage.tenant import normalize_tenant_id

class SourceIndexer:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = SourceRepository(session)
        self.settings = get_settings()
        self.extractor = create_term_extractor(self.settings)
        self.embedder = create_embedding_runtime(self.settings)

    async def index_source(self,
                           tenant_id: Optional[str],
                           collection_id: str,
                           source_id: str,
                           source_type: str,
                           document_name: str,
                           content: str,
                           content_uri: Optional[str],
                           content_metadata: Dict[str, Any]) -> Dict[str, Any]:
        tenant_id = normalize_tenant_id(tenant_id)
                           
        # 1. Compute content hash to avoid re-indexing unchanged text
        content_hash = compute_content_hash(content)
        
        # 2. Check existing
        existing_doc = await self.repo.get_document_by_source(tenant_id, collection_id, source_id)
        if existing_doc and existing_doc.content_hash == content_hash:
            return {
                "status": "unchanged",
                "documentId": str(existing_doc.id),
                "chunkCount": 0,
                "termCount": 0,
                "chunkTermCount": 0,
                "contentHash": content_hash
            }

        # 3. Parsing
        normalized_content, merged_metadata = self._parse_content(content, source_type, content_metadata)

        # 4. Chunking
        chunks = self._chunk_document(normalized_content, source_type)
        
        # 5. ML Operations: Extract terms & Embed
        # Done before opening a transaction to avoid holding DB locks
        chunk_texts = [c.content for c in chunks]
        embeddings = self._create_embeddings(chunk_texts)
        candidates = self._extract_terms(chunks)
        
        # 6. Prepare DB Payloads
        payloads = self._prepare_db_payloads(
            tenant_id=tenant_id,
            collection_id=collection_id,
            source_id=source_id,
            document_name=document_name,
            source_type=source_type,
            content_uri=content_uri,
            content_hash=content_hash,
            normalized_content=normalized_content,
            merged_metadata=merged_metadata,
            chunks=chunks,
            embeddings=embeddings,
            candidates=candidates
        )
        
        # 7. Execute Transaction
        await self.repo.delete_document_by_source(tenant_id, collection_id, source_id)
        
        doc_id = await self.repo.save_indexed_source(
            payloads["document_data"],
            payloads["chunks_data"],
            payloads["terms_data"],
            payloads["chunk_terms_data"]
        )
        
        await self.repo.cleanup_orphan_terms(tenant_id, collection_id)
        await self.session.commit()

        return {
            "status": "indexed",
            "documentId": str(doc_id),
            "chunkCount": len(payloads["chunks_data"]),
            "termCount": len(payloads["terms_data"]),
            "chunkTermCount": len(payloads["chunk_terms_data"]),
            "contentHash": content_hash
        }

    def _parse_content(self, content: str, source_type: str, content_metadata: Dict[str, Any]) -> tuple[str, Dict[str, Any]]:
        if source_type == "markdown":
            parsed = parse_markdown(content)
        else:
            # Fallback to plain text for unsupported types for now
            parsed = parse_text(content)
            
        merged_metadata = {**content_metadata, **parsed.metadata}
        return parsed.content, merged_metadata

    def _chunk_document(self, normalized_content: str, source_type: str) -> list[Any]:
        chunk_input = ChunkDocumentInput(
            content=normalized_content, 
            source_type="markdown" if source_type == "markdown" else "text"
        )
        chunk_opts = ChunkingOptions(
            target_tokens=self.settings.LGS_CHUNK_TARGET_TOKENS,
            overlap_tokens=self.settings.LGS_CHUNK_OVERLAP_TOKENS,
            min_chunk_tokens=self.settings.LGS_CHUNK_MIN_TOKENS,
        )
        chunker = create_chunker(self.settings)
        return chunker.chunk_document(chunk_input, chunk_opts)

    def _create_embeddings(self, chunk_texts: list[str]) -> list[list[float]]:
        if not chunk_texts:
            return []
            
        embeddings = self.embedder.create_embeddings(chunk_texts)
        if len(embeddings) != len(chunk_texts):
            raise RuntimeError(f"embedding_count_mismatch: expected {len(chunk_texts)}, got {len(embeddings)}")
            
        for index, embedding in enumerate(embeddings):
            if len(embedding) != self.settings.EMBEDDING_DIMENSIONS:
                raise RuntimeError(
                    f"embedding_dimensions_mismatch:{index}: expected {self.settings.EMBEDDING_DIMENSIONS}, got {len(embedding)}"
                )
        return embeddings

    def _extract_terms(self, chunks: list[Any]) -> list[Any]:
        ext_chunks = [
            ExtractorChunk(chunkId=str(i), content=c.content) 
            for i, c in enumerate(chunks)
        ]
        labels = [
            label.strip()
            for label in self.settings.TERM_EXTRACTOR_LABELS.split(",")
            if label.strip()
        ]
        return self.extractor.extract_terms(
            ext_chunks,
            labels=labels,
            threshold=self.settings.TERM_EXTRACTOR_THRESHOLD,
        )

    def _prepare_db_payloads(
        self, tenant_id: str, collection_id: str, source_id: str, 
        document_name: str, source_type: str, content_uri: Optional[str], 
        content_hash: str, normalized_content: str, merged_metadata: Dict[str, Any], 
        chunks: list[Any], embeddings: list[list[float]], candidates: list[Any]
    ) -> Dict[str, Any]:
        
        document_data = {
            "tenant_id": tenant_id,
            "collection_id": collection_id,
            "source_id": source_id,
            "document_name": document_name,
            "source_type": source_type,
            "source_uri": content_uri,
            "content_hash": content_hash,
            "normalized_content": normalized_content,
            "content_metadata": merged_metadata
        }
        
        chunks_data = [
            {
                "id": uuid.uuid4(),
                "chunk_index": c.chunk_index,
                "content": c.content,
                "content_hash": compute_content_hash(c.content),
                "start_offset": c.start_offset,
                "end_offset": c.end_offset,
                "token_count": c.estimated_tokens,
                "embedding": embeddings[i],
                "embedding_model": self.settings.EMBEDDING_MODEL,
                "embedding_dimensions": self.settings.EMBEDDING_DIMENSIONS
            }
            for i, c in enumerate(chunks)
        ]
            
        terms_data_map = {
            f"{cand.normalized_text}:::{cand.label}": {
                "collection_id": collection_id,
                "tenant_id": tenant_id,
                "text": cand.text,
                "normalized_text": cand.normalized_text,
                "label": cand.label,
                "status": "raw"
            }
            for cand in candidates
        }
        
        chunk_terms_data = [
            {
                "chunk_id": chunks_data[int(cand.chunkId)]["id"],
                "_normalized_text": cand.normalized_text,
                "_label": cand.label,
                "source": "gliner",
                "label": cand.label,
                "start_offset": cand.startOffset,
                "end_offset": cand.endOffset,
                "confidence_score": cand.confidence
            }
            for cand in candidates
        ]

        return {
            "document_data": document_data,
            "chunks_data": chunks_data,
            "terms_data": list(terms_data_map.values()),
            "chunk_terms_data": chunk_terms_data
        }
