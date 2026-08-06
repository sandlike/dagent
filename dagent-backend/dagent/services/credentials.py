from cryptography.fernet import Fernet, InvalidToken

from dagent.api.errors import ExternalDependencyError
from dagent.config import Settings, get_settings


def _cipher(settings: Settings | None = None) -> Fernet:
    key = (settings or get_settings()).GIT_CREDENTIAL_ENCRYPTION_KEY.strip()
    if not key:
        raise ExternalDependencyError("Git credential encryption key is not configured")
    try:
        return Fernet(key.encode("ascii"))
    except (TypeError, ValueError) as exc:
        raise ExternalDependencyError("Git credential encryption key is invalid") from exc


def encrypt_git_token(token: str, settings: Settings | None = None) -> str:
    return _cipher(settings).encrypt(token.encode("utf-8")).decode("ascii")


def decrypt_git_token(ciphertext: str, settings: Settings | None = None) -> str:
    try:
        return _cipher(settings).decrypt(ciphertext.encode("ascii")).decode("utf-8")
    except (InvalidToken, UnicodeDecodeError, ValueError) as exc:
        raise ExternalDependencyError("Stored Git credential cannot be decrypted") from exc


def encrypt_model_token(token: str, settings: Settings | None = None) -> str:
    return _cipher(settings).encrypt(token.encode("utf-8")).decode("ascii")


def decrypt_model_token(ciphertext: str, settings: Settings | None = None) -> str:
    try:
        return _cipher(settings).decrypt(ciphertext.encode("ascii")).decode("utf-8")
    except (InvalidToken, UnicodeDecodeError, ValueError) as exc:
        raise ExternalDependencyError("Stored model credential cannot be decrypted") from exc
