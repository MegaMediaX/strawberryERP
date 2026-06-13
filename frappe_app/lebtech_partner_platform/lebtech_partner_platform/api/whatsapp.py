from __future__ import annotations

import frappe


class WhatsAppService:
    def __init__(self, provider: str | None = None):
        configured_provider = frappe.db.get_value(
            "Integration Setting",
            {"integration_type": "WhatsApp", "is_enabled": 1},
            "provider",
        )
        self.provider = (provider or configured_provider or frappe.conf.get("default_whatsapp_provider") or "meta").lower()

    def is_configured(self):
        if self.provider == "wasender":
            return bool(frappe.conf.get("wasender_api_key"))
        return bool(frappe.conf.get("whatsapp_meta_token"))

    def send_template(self, to: str, template: str, variables: dict | None = None):
        provider = self._provider()
        return provider.send_template(to=to, template=template, variables=variables or {})

    def _provider(self):
        if self.provider == "wasender":
            return WasenderProvider()
        return MetaProvider()


class MetaProvider:
    def send_template(self, to: str, template: str, variables: dict):
        token = frappe.conf.get("whatsapp_meta_token")
        if not token:
            frappe.throw("Meta WhatsApp token is not configured.")
        return {"provider": "meta", "to": to, "template": template, "queued": True, "variables": variables}


class WasenderProvider:
    def send_template(self, to: str, template: str, variables: dict):
        api_key = frappe.conf.get("wasender_api_key")
        if not api_key:
            frappe.throw("Wasender API key is not configured.")
        return {"provider": "wasender", "to": to, "template": template, "queued": True, "variables": variables}


@frappe.whitelist(methods=["POST"])
def send_template(to: str, template: str, provider: str | None = None, variables: dict | None = None):
    return WhatsAppService(provider).send_template(to=to, template=template, variables=variables)


def queue_follow_up_reminder(lead_name: str):
    lead = frappe.get_doc("Partner Lead", lead_name)
    service = WhatsAppService()
    if not service.is_configured():
        return {"queued": False, "reason": "whatsapp_not_configured", "lead": lead.name}
    return service.send_template(
        to=lead.phone,
        template="follow_up",
        variables={"company": lead.company_name, "date": str(lead.follow_up_date)},
    )
