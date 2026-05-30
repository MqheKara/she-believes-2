"""Mock external services (SPEC §16). Each logs to mock_messages so the
admin Demo Inbox can show what *would* have been sent in production.
Call sites stay stable; v2 swaps the internals for Twilio/WA/Postmark."""
from ..extensions import db
from ..models import MockMessage


def _log(channel, recipient, body, subject=None):
    db.session.add(
        MockMessage(channel=channel, recipient=recipient or "", body=body, subject=subject)
    )


class SMSService:
    @staticmethod
    def send(phone, body):
        _log("sms", phone, body)


class WhatsAppService:
    @staticmethod
    def send(phone, body):
        _log("whatsapp", phone, body)


class EmailService:
    @staticmethod
    def send(email, subject, body):
        _log("email", email, body, subject=subject)


sms = SMSService()
whatsapp = WhatsAppService()
email = EmailService()


def deliver_ticket(phone, event_title, attendee_name, ticket_id):
    """Mock SMS + WhatsApp delivery of a ticket (used on approve / walk-in)."""
    body = (
        f"Your ticket for {event_title} is ready. "
        f"Attendee: {attendee_name}. View it in your account. Come expectant."
    )
    sms.send(phone, body)
    whatsapp.send(phone, body)
