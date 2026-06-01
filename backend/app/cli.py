"""Flask CLI commands for admin account management.

Run these from the Render Shell (Dashboard → your Web Service → Shell tab):

    flask create-admin --email you@example.com --password 'StrongPass123' --phone +263771234567
    flask reset-admin-password --email you@example.com --password 'NewPass123'
    flask promote-user --email existing@user.com           # make an existing user an admin
    flask list-admins

These are CLI-only — there is no public HTTP endpoint, so no attack surface.
"""
import click
from flask.cli import with_appcontext

from .extensions import db
from .hashing import hash_secret
from .models import User


def register_cli(app):
    app.cli.add_command(create_admin)
    app.cli.add_command(reset_admin_password)
    app.cli.add_command(promote_user)
    app.cli.add_command(list_admins)


@click.command("create-admin")
@click.option("--email", required=True)
@click.option("--password", required=True)
@click.option("--phone", default="+263000000000", help="E.164 phone, must be unique")
@click.option("--name", default="Administrator")
@with_appcontext
def create_admin(email, password, phone, name):
    """Create a brand-new admin user."""
    email = email.strip().lower()
    existing = User.query.filter_by(email=email).first()
    if existing:
        raise click.ClickException(
            f"A user with email {email} already exists (role={existing.role}). "
            f"Use `flask reset-admin-password` or `flask promote-user` instead."
        )
    if User.query.filter_by(phone=phone).first():
        raise click.ClickException(f"Phone {phone} is already taken — pass a different --phone.")
    admin = User(
        role="admin",
        name=name,
        email=email,
        phone=phone,
        password_hash=hash_secret(password),
    )
    db.session.add(admin)
    db.session.commit()
    click.echo(f"✓ Created admin: {email}")


@click.command("reset-admin-password")
@click.option("--email", required=True)
@click.option("--password", required=True)
@with_appcontext
def reset_admin_password(email, password):
    """Reset the password for an existing admin (or organizer)."""
    email = email.strip().lower()
    user = User.query.filter_by(email=email).first()
    if not user:
        raise click.ClickException(f"No user found with email {email}.")
    if user.role not in ("admin", "organizer"):
        raise click.ClickException(
            f"User {email} has role '{user.role}', not admin/organizer. "
            f"Use `flask promote-user` first if you want to make them an admin."
        )
    user.password_hash = hash_secret(password)
    db.session.commit()
    click.echo(f"✓ Password reset for {user.role}: {email}")


@click.command("promote-user")
@click.option("--email", required=True)
@click.option("--password", default=None, help="Optional: also set a new password")
@with_appcontext
def promote_user(email, password):
    """Promote an existing user to admin. Optionally set a new password."""
    email = email.strip().lower()
    user = User.query.filter_by(email=email).first()
    if not user:
        raise click.ClickException(f"No user found with email {email}.")
    old_role = user.role
    user.role = "admin"
    if password:
        user.password_hash = hash_secret(password)
    db.session.commit()
    msg = f"✓ Promoted {email}: {old_role} → admin"
    if password:
        msg += " (password also updated)"
    click.echo(msg)


@click.command("list-admins")
@with_appcontext
def list_admins():
    """List all admin and organizer accounts."""
    staff = User.query.filter(User.role.in_(("admin", "organizer"))).all()
    if not staff:
        click.echo("No admin/organizer accounts found.")
        return
    for u in staff:
        click.echo(f"  [{u.role}] {u.email}  ({u.name}, {u.phone})")
