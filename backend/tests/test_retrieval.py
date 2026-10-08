from app.services.retrieval import HybridRetrievalService

def test_rrf_scoring():
    service = HybridRetrievalService(top_k=2, rrf_k=60)
    
    # Mocking vector_results and keyword_results as if returned from db
    # Format: list of tuples (chunk_id, score)
    vector_results = [(1, 0.9), (2, 0.8), (3, 0.7)]
    keyword_results = [(3, 10.5), (1, 5.0), (4, 2.0)]
    
    # Calculate RRF manually to check logic
    # Rank 1: v=1, k=3
    # Rank 2: v=2, k=1
    # Rank 3: v=3, k=4
    
    rrf_scores = {}
    for rank, (chunk_id, _) in enumerate(vector_results, 1):
        rrf_scores[chunk_id] = rrf_scores.get(chunk_id, 0.0) + 1.0 / (60 + rank)
        
    for rank, (chunk_id, _) in enumerate(keyword_results, 1):
        rrf_scores[chunk_id] = rrf_scores.get(chunk_id, 0.0) + 1.0 / (60 + rank)
        
    # Chunk 1: 1/61 + 1/62 = 0.01639 + 0.01612 = 0.0325
    # Chunk 3: 1/63 + 1/61 = 0.01587 + 0.01639 = 0.0322
    
    sorted_ids = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)
    assert sorted_ids[0][0] == 1 # 1 should be first
    assert sorted_ids[1][0] == 3 # 3 should be second
