"""Regression tests cho NLP 849 đặc trưng và định tuyến từ khóa cơ quan.

Bộ ca kiểm thử được dùng chung với script
``python -m app.ml.training.check_nlp_regression --strict`` để tránh hai nguồn
sự thật khác nhau giữa CI và môi trường phát triển.
"""

import pytest

from app.ml.training import check_nlp_regression as regression

FEATURE_NAMES = regression.load_feature_names()


def test_nlp_alias_and_sentence_regressions_all_pass():
    results = [
        regression.evaluate(case, FEATURE_NAMES)
        for case in regression.all_cases(FEATURE_NAMES)
    ]
    failures = [result for result in results if not result["passed"]]

    assert not failures, "\n".join(
        f"{item['name']}: {item['text']} | thiếu={item['missing']} "
        f"| nhận sai={item['forbidden_found']} "
        f"| thiếu cảnh báo={item['missing_red_flags']}"
        for item in failures
    )


@pytest.mark.parametrize("name,text,expected", regression.ROUTING_CASES)
def test_keyword_routing_cases(name, text, expected):
    result = regression.evaluate_routing(name, text, expected)

    assert result["passed"], (
        f"{name}: {text} | mong đợi={result['expected']} "
        f"| nhận={result['actual']} (keywords={result['keywords']})"
    )
