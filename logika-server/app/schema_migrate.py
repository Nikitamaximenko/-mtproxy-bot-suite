"""Лёгкие миграции без Alembic: nullable phone + email для пользователей и OTP."""

from __future__ import annotations

import logging

from sqlalchemy import inspect, text
from sqlalchemy.engine import Connection, Engine

logger = logging.getLogger(__name__)


def _migrate_postgres(conn: Connection) -> None:
    insp = inspect(conn)
    ucols = {c["name"]: c for c in insp.get_columns("logika_users")}
    if "email_norm" not in ucols:
        conn.execute(text("ALTER TABLE logika_users ADD COLUMN email_norm VARCHAR(320)"))
        logger.info("migration: logika_users.email_norm added")
    insp = inspect(conn)
    ucols = {c["name"]: c for c in insp.get_columns("logika_users")}
    if "phone_e164" in ucols and ucols["phone_e164"].get("nullable") is False:
        conn.execute(text("ALTER TABLE logika_users ALTER COLUMN phone_e164 DROP NOT NULL"))
        logger.info("migration: logika_users.phone_e164 nullable")

    insp = inspect(conn)
    ocols = {c["name"]: c for c in insp.get_columns("logika_otp_codes")}
    if "email_norm" not in ocols:
        conn.execute(text("ALTER TABLE logika_otp_codes ADD COLUMN email_norm VARCHAR(320)"))
        logger.info("migration: logika_otp_codes.email_norm added")
    insp = inspect(conn)
    ocols = {c["name"]: c for c in insp.get_columns("logika_otp_codes")}
    if "phone_e164" in ocols and ocols["phone_e164"].get("nullable") is False:
        conn.execute(text("ALTER TABLE logika_otp_codes ALTER COLUMN phone_e164 DROP NOT NULL"))
        logger.info("migration: logika_otp_codes.phone_e164 nullable")


def _sqlite_pragma_cols(conn: Connection, table: str) -> dict[str, dict[str, int | str]]:
    rows = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
    # cid, name, type, notnull, dflt_value, pk
    return {str(r[1]): {"notnull": int(r[3] or 0), "type": str(r[2])} for r in rows}


def _sqlite_rebuild_users(conn: Connection) -> None:
    logger.info("migration sqlite: rebuilding logika_users")
    conn.execute(
        text(
            """
            CREATE TABLE logika_users_new (
                id VARCHAR(36) NOT NULL PRIMARY KEY,
                phone_e164 VARCHAR(20),
                name VARCHAR(128),
                email_norm VARCHAR(320),
                created_at DATETIME NOT NULL,
                UNIQUE (phone_e164),
                UNIQUE (email_norm)
            )
            """
        )
    )
    conn.execute(
        text(
            """
            INSERT INTO logika_users_new (id, phone_e164, name, email_norm, created_at)
            SELECT id, phone_e164, name, NULL, created_at FROM logika_users
            """
        )
    )
    conn.execute(text("DROP TABLE logika_users"))
    conn.execute(text("ALTER TABLE logika_users_new RENAME TO logika_users"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_logika_users_phone_e164 ON logika_users (phone_e164)"))


def _sqlite_rebuild_otp(conn: Connection) -> None:
    logger.info("migration sqlite: rebuilding logika_otp_codes")
    conn.execute(
        text(
            """
            CREATE TABLE logika_otp_codes_new (
                id VARCHAR(36) NOT NULL PRIMARY KEY,
                phone_e164 VARCHAR(20),
                email_norm VARCHAR(320),
                code_hash VARCHAR(128) NOT NULL,
                expires_at DATETIME NOT NULL,
                used BOOLEAN NOT NULL,
                created_at DATETIME NOT NULL
            )
            """
        )
    )
    conn.execute(
        text(
            """
            INSERT INTO logika_otp_codes_new
            (id, phone_e164, email_norm, code_hash, expires_at, used, created_at)
            SELECT id, phone_e164, NULL, code_hash, expires_at, used, created_at
            FROM logika_otp_codes
            """
        )
    )
    conn.execute(text("DROP TABLE logika_otp_codes"))
    conn.execute(text("ALTER TABLE logika_otp_codes_new RENAME TO logika_otp_codes"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_logika_otp_codes_phone ON logika_otp_codes (phone_e164)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_logika_otp_codes_email ON logika_otp_codes (email_norm)"))


def _migrate_sqlite(conn: Connection) -> None:
    ucols = _sqlite_pragma_cols(conn, "logika_users")
    if not ucols:
        return
    need_users = "email_norm" not in ucols or (
        "phone_e164" in ucols and int(ucols["phone_e164"].get("notnull") or 0) == 1
    )
    if need_users:
        _sqlite_rebuild_users(conn)

    ocols = _sqlite_pragma_cols(conn, "logika_otp_codes")
    if not ocols:
        return
    need_otp = "email_norm" not in ocols or (
        "phone_e164" in ocols and int(ocols["phone_e164"].get("notnull") or 0) == 1
    )
    if need_otp:
        _sqlite_rebuild_otp(conn)


def run_schema_migrations(engine: Engine) -> None:
    with engine.begin() as conn:
        if engine.dialect.name == "postgresql":
            _migrate_postgres(conn)
        elif engine.dialect.name == "sqlite":
            _migrate_sqlite(conn)
        # commit via engine.begin() context
