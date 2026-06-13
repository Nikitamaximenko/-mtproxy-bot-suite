#!/usr/bin/env python3
"""Unit tests for campaign_engine (CI, no secrets)."""
from __future__ import annotations

import os
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

_REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_REPO / "backend"))

# Minimal env before importing main
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("BOT_TOKEN", "test-token")
os.environ.setdefault("FRONTEND_URL", "https://example.com")

import campaign_engine as ce  # noqa: E402
import main  # noqa: E402

ce.bind_models(
    marketing_campaign=main.MarketingCampaign,
    campaign_variant=main.CampaignVariant,
    campaign_delivery=main.CampaignDelivery,
    campaign_event=main.CampaignEvent,
    user=main.User,
    subscription=main.Subscription,
)

main.Base.metadata.create_all(bind=main.engine)
main._migrate()


class CampaignEngineTests(unittest.TestCase):
    def setUp(self) -> None:
        self.db = main.SessionLocal()

    def tearDown(self) -> None:
        self.db.close()

    def test_seed_idempotent(self) -> None:
        n1 = ce.seed_default_campaigns(self.db, price_rub=299)
        n2 = ce.seed_default_campaigns(self.db, price_rub=299)
        self.assertGreaterEqual(n1, 6)
        self.assertEqual(n2, 0)

    def test_stable_variant_deterministic(self) -> None:
        v1 = main.CampaignVariant(id=1, campaign_id=1, variant_key="A", weight=50, message_html="a")
        v2 = main.CampaignVariant(id=2, campaign_id=1, variant_key="B", weight=50, message_html="b")
        a = ce._stable_variant([v1, v2], 12345, 1)
        b = ce._stable_variant([v1, v2], 12345, 1)
        self.assertEqual(a.variant_key, b.variant_key)

    def test_render_placeholders(self) -> None:
        user = main.User(
            telegram_id=1,
            username="tester",
            first_name="Test",
            ref_source="ads",
            created_at=datetime.now(timezone.utc),
        )
        text = ce._render_placeholders("Hi {greeting}, {price}₽{ref_line}", user, price_rub=299)
        self.assertIn("Test", text)
        self.assertIn("299", text)
        self.assertIn("ads", text)

    def test_campaign_stats_empty(self) -> None:
        camp = main.MarketingCampaign(
            slug="test_stats",
            name="Test",
            kind=ce.CAMPAIGN_KIND_DRIP,
            status=ce.CAMPAIGN_STATUS_ACTIVE,
            audience=ce.AUDIENCE_NON_PAYER,
            trigger_anchor=ce.ANCHOR_USER_CREATED,
            trigger_offset_minutes=60,
        )
        self.db.add(camp)
        self.db.flush()
        self.db.add(
            main.CampaignVariant(
                campaign_id=camp.id,
                variant_key="A",
                weight=100,
                message_html="{greeting} test",
            )
        )
        self.db.commit()
        stats = ce.campaign_stats(self.db, camp.id)
        self.assertEqual(stats["total_sent"], 0)
        self.assertEqual(len(stats["variants"]), 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
