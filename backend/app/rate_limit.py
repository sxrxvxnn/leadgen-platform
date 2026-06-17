from slowapi import Limiter
from slowapi.util import get_remote_address

# Shared limiter — imported by main.py (for middleware) and routes.py (for decorators)
limiter = Limiter(key_func=get_remote_address)
