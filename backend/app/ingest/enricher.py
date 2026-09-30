import ipaddress
import logging
import os
from typing import List

from app.ingest.models import TransactionRecord

logger = logging.getLogger(__name__)

try:
    import geoip2.database
    import geoip2.errors
except ImportError:
    geoip2 = None


def is_private_ip(ip: str) -> bool:
    """Return True if IP is private, loopback, reserved, or malformed."""
    if not ip or not isinstance(ip, str):
        return True
    try:
        ip_obj = ipaddress.ip_address(ip.strip())
        return (
            ip_obj.is_private
            or ip_obj.is_loopback
            or ip_obj.is_reserved
            or ip_obj.is_link_local
            or ip_obj.is_multicast
        )
    except ValueError:
        return True


def enrich_with_geoip(
    records: List[TransactionRecord], mmdb_path: str
) -> List[TransactionRecord]:
    """Enrich transaction records with GeoIP city and ASN telemetry using MaxMind .mmdb."""
    if not os.path.exists(mmdb_path):
        logger.warning("GeoIP database file not found at '%s'. Skipping enrichment.", mmdb_path)
        return records

    if geoip2 is None:
        logger.warning("geoip2 library is not installed. Skipping GeoIP enrichment.")
        return records

    reader = None
    try:
        reader = geoip2.database.Reader(mmdb_path)
    except Exception as e:
        logger.error("Failed to open GeoIP database '%s': %s", mmdb_path, e)
        return records

    enriched_count = 0
    unresolved_count = 0

    try:
        for rec in records:
            if not rec.src_ip:
                unresolved_count += 1
                continue

            clean_ip = rec.src_ip.strip()
            if is_private_ip(clean_ip):
                logger.debug("IP %s is private or reserved; skipping GeoIP lookup", clean_ip)
                unresolved_count += 1
                continue

            try:
                # Query City database
                resp = reader.city(clean_ip)
                if resp.country and resp.country.iso_code:
                    rec.geo_country = resp.country.iso_code
                if resp.city and resp.city.name:
                    rec.city = resp.city.name
                if resp.location:
                    rec.lat = resp.location.latitude
                    rec.lon = resp.location.longitude

                # Attempt ASN lookup if method exists on database
                if hasattr(reader, "asn"):
                    try:
                        asn_resp = reader.asn(clean_ip)
                        if asn_resp.autonomous_system_number:
                            org = asn_resp.autonomous_system_organization or ""
                            rec.asn = f"AS{asn_resp.autonomous_system_number} {org}".strip()
                    except Exception:
                        pass

                enriched_count += 1
            except (geoip2.errors.AddressNotFoundError, ValueError) as err:
                logger.debug("GeoIP lookup unresolved for %s: %s", clean_ip, err)
                unresolved_count += 1
            except Exception as ex:
                logger.warning("Unexpected error during GeoIP lookup for %s: %s", clean_ip, ex)
                unresolved_count += 1
    finally:
        if reader is not None:
            reader.close()

    logger.info("%d IPs enriched, %d unresolved", enriched_count, unresolved_count)
    return records
