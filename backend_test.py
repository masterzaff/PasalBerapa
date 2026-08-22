#!/usr/bin/env python3
"""
PasalBerapa? Backend API Test Suite
Tests the reference contract stub endpoints: /api/health, /api/mask, /api/analyze
"""
import requests
import sys
import json

BASE_URL = "https://pii-legal-hub.preview.emergentagent.com/api"

class BackendTester:
    def __init__(self):
        self.tests_run = 0
        self.tests_passed = 0
        self.failures = []

    def test(self, name, fn):
        """Run a single test"""
        self.tests_run += 1
        print(f"\n{'='*60}")
        print(f"🔍 Test {self.tests_run}: {name}")
        print('='*60)
        try:
            fn()
            self.tests_passed += 1
            print(f"✅ PASSED: {name}")
            return True
        except AssertionError as e:
            print(f"❌ FAILED: {name}")
            print(f"   Error: {str(e)}")
            self.failures.append({"test": name, "error": str(e)})
            return False
        except Exception as e:
            print(f"❌ ERROR: {name}")
            print(f"   Exception: {str(e)}")
            self.failures.append({"test": name, "error": f"Exception: {str(e)}"})
            return False

    def summary(self):
        """Print test summary"""
        print(f"\n{'='*60}")
        print("📊 TEST SUMMARY")
        print('='*60)
        print(f"Total Tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        if self.failures:
            print(f"\n❌ Failed Tests:")
            for f in self.failures:
                print(f"  - {f['test']}: {f['error']}")
        
        return 0 if self.tests_passed == self.tests_run else 1


def test_health():
    """Test GET /api/health"""
    url = f"{BASE_URL}/health"
    print(f"GET {url}")
    
    resp = requests.get(url, timeout=10)
    print(f"Status: {resp.status_code}")
    print(f"Response: {resp.text}")
    
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    
    data = resp.json()
    assert "status" in data, "Response missing 'status' field"
    assert data["status"] == "ok", f"Expected status='ok', got '{data['status']}'"
    print(f"✓ Health check OK: {data}")


def test_mask_basic():
    """Test POST /api/mask with basic text"""
    url = f"{BASE_URL}/mask"
    payload = {
        "text": "Kontrak ini dibuat oleh Andi Wibowo dengan email andi@example.com",
        "session_id": "test_session_1"
    }
    
    print(f"POST {url}")
    print(f"Payload: {json.dumps(payload, indent=2)}")
    
    resp = requests.post(url, json=payload, timeout=10)
    print(f"Status: {resp.status_code}")
    print(f"Response: {resp.text[:500]}")
    
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    
    data = resp.json()
    assert "masked_text" in data, "Response missing 'masked_text'"
    assert "mapping" in data, "Response missing 'mapping'"
    assert "entities" in data, "Response missing 'entities'"
    
    # Check that masking occurred
    masked = data["masked_text"]
    assert "<" in masked and ">" in masked, "No masking tags found in masked_text"
    
    # Check mapping structure
    mapping = data["mapping"]
    assert isinstance(mapping, dict), "mapping should be a dict"
    assert len(mapping) > 0, "mapping should not be empty"
    
    # Check entities structure
    entities = data["entities"]
    assert isinstance(entities, list), "entities should be a list"
    assert len(entities) > 0, "entities should not be empty"
    
    print(f"✓ Masked text: {masked[:100]}...")
    print(f"✓ Mapping keys: {list(mapping.keys())}")
    print(f"✓ Entity types: {[e.get('type') for e in entities]}")


def test_mask_pii_types():
    """Test POST /api/mask with various PII types"""
    url = f"{BASE_URL}/mask"
    payload = {
        "text": """
        Nama: Budi Santoso
        Email: budi.santoso@gmail.com
        NIK: 3201234567890123
        Telepon: 081234567890
        """,
        "session_id": "test_session_2"
    }
    
    print(f"POST {url}")
    print(f"Testing PII types: name, email, NIK, phone")
    
    resp = requests.post(url, json=payload, timeout=10)
    print(f"Status: {resp.status_code}")
    
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    
    data = resp.json()
    entities = data.get("entities", [])
    entity_types = {e.get("type") for e in entities}
    
    print(f"✓ Detected entity types: {entity_types}")
    
    # Check for expected PII types
    expected_types = {"EMAIL", "NIK", "PHONE"}
    found_types = entity_types & expected_types
    
    assert len(found_types) >= 2, f"Expected at least 2 PII types from {expected_types}, found {found_types}"
    print(f"✓ Successfully masked PII types: {found_types}")


def test_analyze_risk_mode():
    """Test POST /api/analyze with mode='risk'"""
    url = f"{BASE_URL}/analyze"
    payload = {
        "masked_text": "Perjanjian ini mengatur denda sebesar Rp 10.000.000 jika terjadi pelanggaran sepihak.",
        "mode": "risk",
        "session_id": "test_session_3"
    }
    
    print(f"POST {url}")
    print(f"Mode: risk")
    
    resp = requests.post(url, json=payload, timeout=10)
    print(f"Status: {resp.status_code}")
    print(f"Response: {resp.text[:500]}")
    
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    
    data = resp.json()
    assert "reply" in data, "Response missing 'reply'"
    assert "risk_score" in data, "Response missing 'risk_score'"
    assert "risks" in data, "Response missing 'risks'"
    
    # Validate risk_score
    risk_score = data["risk_score"]
    assert isinstance(risk_score, (int, float)), f"risk_score should be numeric, got {type(risk_score)}"
    assert 0 <= risk_score <= 100, f"risk_score should be 0-100, got {risk_score}"
    
    # Validate risks array
    risks = data["risks"]
    assert isinstance(risks, list), "risks should be a list"
    
    if len(risks) > 0:
        risk = risks[0]
        assert "level" in risk, "Risk missing 'level'"
        assert "title" in risk, "Risk missing 'title'"
        assert "explanation" in risk, "Risk missing 'explanation'"
        assert risk["level"] in ["high", "warning", "safe"], f"Invalid risk level: {risk['level']}"
        print(f"✓ Found {len(risks)} risks, score: {risk_score}")
        print(f"✓ First risk: {risk['title']} ({risk['level']})")
    else:
        print(f"✓ No risks found (score: {risk_score})")


def test_analyze_summary_mode():
    """Test POST /api/analyze with mode='summary'"""
    url = f"{BASE_URL}/analyze"
    payload = {
        "masked_text": "Perjanjian kerja antara <PERSON_1> dan PT Example untuk masa kerja 2 tahun.",
        "mode": "summary",
        "session_id": "test_session_4"
    }
    
    print(f"POST {url}")
    print(f"Mode: summary")
    
    resp = requests.post(url, json=payload, timeout=10)
    print(f"Status: {resp.status_code}")
    
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    
    data = resp.json()
    assert "reply" in data, "Response missing 'reply'"
    
    reply = data["reply"]
    assert isinstance(reply, str), "reply should be a string"
    assert len(reply) > 0, "reply should not be empty"
    
    print(f"✓ Summary reply: {reply[:100]}...")


def test_analyze_key_articles_mode():
    """Test POST /api/analyze with mode='key_articles'"""
    url = f"{BASE_URL}/analyze"
    payload = {
        "masked_text": "Perjanjian ini mengacu pada Pasal 1320 KUHPerdata.",
        "mode": "key_articles",
        "session_id": "test_session_5"
    }
    
    print(f"POST {url}")
    print(f"Mode: key_articles")
    
    resp = requests.post(url, json=payload, timeout=10)
    print(f"Status: {resp.status_code}")
    
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    
    data = resp.json()
    assert "reply" in data, "Response missing 'reply'"
    
    reply = data["reply"]
    assert isinstance(reply, str), "reply should be a string"
    assert len(reply) > 0, "reply should not be empty"
    
    print(f"✓ Key articles reply: {reply[:100]}...")


def test_analyze_chat_mode():
    """Test POST /api/analyze with mode='chat'"""
    url = f"{BASE_URL}/analyze"
    payload = {
        "masked_text": "Kontrak kerja dengan <PERSON_1> untuk posisi developer.",
        "mode": "chat",
        "question": "Apa saja kewajiban saya?",
        "session_id": "test_session_6"
    }
    
    print(f"POST {url}")
    print(f"Mode: chat")
    print(f"Question: {payload['question']}")
    
    resp = requests.post(url, json=payload, timeout=10)
    print(f"Status: {resp.status_code}")
    
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    
    data = resp.json()
    assert "reply" in data, "Response missing 'reply'"
    
    reply = data["reply"]
    assert isinstance(reply, str), "reply should be a string"
    assert len(reply) > 0, "reply should not be empty"
    
    print(f"✓ Chat reply: {reply[:100]}...")


def main():
    tester = BackendTester()
    
    print("="*60)
    print("PasalBerapa? Backend API Test Suite")
    print(f"Base URL: {BASE_URL}")
    print("="*60)
    
    # Run all tests
    tester.test("Health Check", test_health)
    tester.test("Mask - Basic Text", test_mask_basic)
    tester.test("Mask - PII Types (Email, NIK, Phone, Name)", test_mask_pii_types)
    tester.test("Analyze - Risk Mode", test_analyze_risk_mode)
    tester.test("Analyze - Summary Mode", test_analyze_summary_mode)
    tester.test("Analyze - Key Articles Mode", test_analyze_key_articles_mode)
    tester.test("Analyze - Chat Mode", test_analyze_chat_mode)
    
    return tester.summary()


if __name__ == "__main__":
    sys.exit(main())
