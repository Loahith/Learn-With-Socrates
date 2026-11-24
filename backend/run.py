import socket

try:
    _raw_h = socket.gethostname()
    _raw_h.encode("ascii")
except Exception:
    socket.gethostname = lambda: "localhost"
    socket.getfqdn = lambda *args, **kwargs: "localhost"

from app import create_app

app = create_app()

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=app.config["DEBUG"])

