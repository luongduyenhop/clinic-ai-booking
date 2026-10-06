from slowapi import Limiter
from slowapi.util import get_remote_address

# Khởi tạo in-memory rate limiter dựa trên IP của client
limiter = Limiter(key_func=get_remote_address)
