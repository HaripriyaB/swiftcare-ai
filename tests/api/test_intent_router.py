from api.orchestrator import attention_reason_reply, classify_intent, extract_patient_matches, is_attention_reason_request, is_operational_queue_request, is_today_priority_request, should_refuse_clinical, with_patient_name


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


def test_today_priority_request_is_routed_before_the_chart_agent():
    assert is_today_priority_request("What is today's important work?")
    assert is_today_priority_request("What should I work on first?")
    assert not is_today_priority_request("When was this patient's last visit?")


def test_operational_action_questions_are_routed_to_the_attention_queue():
    assert is_operational_queue_request("Show follow-up action patients only")
    assert is_operational_queue_request("Which medium priority patients need outreach?")
    assert not is_operational_queue_request("Show this patient's medications")


def test_attention_reason_request_requires_an_open_patient():
    assert is_attention_reason_request(
        "Why does this patient need attention today?", has_active_patient=True
    )
    assert not is_attention_reason_request(
        "Why does this patient need attention today?", has_active_patient=False
    )


def test_attention_reason_reply_uses_the_stored_queue_evidence(monkeypatch):
    monkeypatch.setattr(
        "api.continuity.get_open_card_for_patient",
        lambda _: {
            "priority": "HIGH",
            "action_label": "Coordinate a care-team review",
            "why_now": "Several active health items are documented for staff review.",
            "evidence": [
                {"label": "Active items on file", "value": "8 conditions"},
                {"label": "Last recorded visit", "value": "2019-09-23"},
            ],
        },
    )

    reply = attention_reason_reply("patient-1")

    assert "High priority" in reply
    assert "Coordinate a care-team review" in reply
    assert "8 conditions" in reply
    assert "2019-09-23" in reply
    assert "not a diagnosis" in reply


def test_patient_reply_is_prefixed_with_the_active_patient_name(monkeypatch):
    monkeypatch.setattr("api.orchestrator._patient_display_name", lambda _: "Myles Johnson")
    assert with_patient_name("Latest vitals are available.", "patient-1") == "Myles Johnson\n\nLatest vitals are available."


def test_extract_patient_matches_turns_markdown_rows_into_structured_choices():
    reply, patients = extract_patient_matches(
        """Matching patients
| # | First name | Last name | Location | Last visit | Patient ID | Match |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Clinton763 | Kuhn96 | Brookline, Massachusetts | 2005-09-25 | `00b97c3a-ffbe-4d01-a110-d3d7786bebc4` | Last name |"""
    )

    assert "|" not in reply
    assert "Choose a patient" in reply
    assert patients == [
        {
            "patient_id": "00b97c3a-ffbe-4d01-a110-d3d7786bebc4",
            "display_first_name": "Clinton",
            "display_last_name": "Kuhn",
            "city": "Brookline",
            "state": "Massachusetts",
            "last_visit_date": "2005-09-25",
            "matched_on": "Last name",
        }
    ]
