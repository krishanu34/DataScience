import math


def unique(doc_ids):
    # Chunks are collapsed to documents: a document is ranked where its first chunk appears.
    return list(dict.fromkeys(doc_ids))


def recall_at_k(ranked, relevant, k):
    return len(set(ranked[:k]) & set(relevant)) / len(relevant)


def hit_at_k(ranked, relevant, k):
    return float(any(doc_id in relevant for doc_id in ranked[:k]))


def precision_at_k(ranked, relevant, k):
    return sum(doc_id in relevant for doc_id in ranked[:k]) / k


def reciprocal_rank(ranked, relevant):
    for position, doc_id in enumerate(ranked, start=1):
        if doc_id in relevant:
            return 1 / position
    return 0.0


def average_precision(ranked, relevant):
    hits, total = 0, 0.0
    for position, doc_id in enumerate(ranked, start=1):
        if doc_id in relevant:
            hits += 1
            total += hits / position
    return total / len(relevant)


def ndcg_at_k(ranked, relevant, k):
    # relevant maps doc_id -> grade (2 = primary, 1 = supporting).
    def dcg(grades):
        return sum((2**grade - 1) / math.log2(position + 1) for position, grade in enumerate(grades, start=1))

    actual = dcg([relevant.get(doc_id, 0) for doc_id in ranked[:k]])
    ideal = dcg(sorted(relevant.values(), reverse=True)[:k])
    return actual / ideal if ideal else 0.0


def mean(values):
    values = list(values)
    return sum(values) / len(values) if values else 0.0
