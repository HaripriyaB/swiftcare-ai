from api.orchestrator import classify_intent, should_refuse_clinical


def test_classify_insights():
    assert classify_intent("Which patients have care gaps?", has_active_patient=False) == "insights"
    assert classify_intent("Show risk distribution", has_active_patient=True) == "insights"


def test_classify_retrieval():
    assert classify_intent("What meds are they on?", has_active_patient=True) == "retrieval"
    assert classify_intent("Show vitals", has_active_patient=False) == "retrieval"


def test_classify_suggestion():
    assert (
        classify_intent("Create an allergy awareness advisory card", has_active_patient=True)
        == "suggestion"
    )


def test_classify_default_with_patient():
    assert classify_intent("Tell me more", has_active_patient=True) == "retrieval"


def test_classify_default_without_patient():
    assert classify_intent("Hello", has_active_patient=False) == "insights"


def test_refuse_clinical():
    assert should_refuse_clinical("Please diagnose this patient")
    assert should_refuse_clinical("Prescribe an antibiotic")
    assert not should_refuse_clinical("List care gaps")
